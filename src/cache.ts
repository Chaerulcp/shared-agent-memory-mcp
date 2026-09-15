import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { load as loadSqliteVec } from "sqlite-vec";
import { z } from "zod";
import type { Memory, SearchOptions } from "./store.js";
import { loadDotEnv } from "./config.js";
import { SEMANTIC_CHUNK_SIZE, SEMANTIC_CHUNK_STEP } from "./semantic-chunks.js";

export interface CacheMemory {
  id: string;
  title: string;
  content: string;
  project?: string;
  status: string;
  updatedAt: string;
  dataJson?: string;
}

export type EmbeddingKey = {
  readonly memoryId: string;
  readonly chunkIndex: number;
  readonly model: string;
  readonly contentHash: string;
};

export type SemanticVectorHit = {
  readonly id: string;
  readonly chunkIndex: number;
};

export interface MemoryCache {
  replaceAll(memories: CacheMemory[]): void;
  search(query: string, project?: string, limit?: number, status?: string): CacheMemory[];
  list(project?: string): CacheMemory[];
  getEmbedding(key: EmbeddingKey): Float32Array | undefined;
  setEmbedding(key: EmbeddingKey, vector: Float32Array): void;
  hasMatchingRecords(options: SearchOptions): boolean;
  listMissingEmbeddings(model: string, width: number, options: SearchOptions): CacheMemory[];
  searchEmbeddingHits(model: string, vector: Float32Array, options: SearchOptions, limit?: number): SemanticVectorHit[];
  getById(id: string): CacheMemory | undefined;
  count(): number;
  isFresh(maxAgeMs?: number): boolean;
  clear(): void;
  close(): void;
}

function quoteFtsToken(token: string): string {
  return `"${token.replaceAll('"', '""')}"`;
}

const MIN_SIMILARITY = 0.2;

const cacheRowSchema = z.object({
  id: z.string(), title: z.string(), content: z.string(),
  project: z.string().nullable().transform((value) => value ?? undefined),
  status: z.string(), updatedAt: z.string(),
  dataJson: z.string().nullable().transform((value) => value ?? undefined),
});

function semanticFilter(options: SearchOptions): { sql: string; params: string[] } {
  const clauses: string[] = [];
  const params: string[] = [];
  if (options.project) { clauses.push("c.project = ?"); params.push(options.project); }
  if (options.status !== "all") { clauses.push("c.status = ?"); params.push(options.status ?? "active"); }
  if (options.agent) { clauses.push("json_extract(c.data_json, '$.agent') = ?"); params.push(options.agent); }
  if (options.category) { clauses.push("json_extract(c.data_json, '$.category') = ?"); params.push(options.category); }
  if (options.tag) {
    clauses.push("EXISTS (SELECT 1 FROM json_each(c.data_json, '$.tags') AS tag WHERE tag.value = ?)");
    params.push(options.tag);
  }
  return { sql: clauses.length ? ` AND ${clauses.join(" AND ")}` : "", params };
}

export function createMemoryCache(path = cachePath()): MemoryCache {
  if (!path.startsWith(":memory:")) mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS memory_cache (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL,
      project TEXT, status TEXT NOT NULL, updated_at TEXT NOT NULL,
      data_json TEXT
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
      id UNINDEXED, title, content, project UNINDEXED
    );
    CREATE TABLE IF NOT EXISTS cache_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS semantic_embeddings (
      memory_id TEXT NOT NULL, chunk_index INTEGER NOT NULL, model TEXT NOT NULL,
      content_hash TEXT NOT NULL, vector BLOB NOT NULL,
      PRIMARY KEY (memory_id, chunk_index)
    );
  `);
  const columns = db.prepare("PRAGMA table_info(memory_cache)").all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "data_json")) db.exec("ALTER TABLE memory_cache ADD COLUMN data_json TEXT");
  const embeddingColumns = z.array(z.object({ name: z.string() })).parse(db.prepare("PRAGMA table_info(semantic_embeddings)").all());
  if (!embeddingColumns.some((column) => column.name === "chunk_index")) {
    db.exec(`
      DROP TABLE semantic_embeddings;
      CREATE TABLE semantic_embeddings (
        memory_id TEXT NOT NULL, chunk_index INTEGER NOT NULL, model TEXT NOT NULL,
        content_hash TEXT NOT NULL, vector BLOB NOT NULL,
        PRIMARY KEY (memory_id, chunk_index)
      );
    `);
  }
  const embeddingVersion = db.prepare("SELECT value FROM cache_meta WHERE key = 'embedding_consistency'").get() as { value: string } | undefined;
  if (embeddingVersion?.value !== "3") {
    db.transaction(() => {
      db.exec("DELETE FROM semantic_embeddings");
      db.prepare("INSERT OR REPLACE INTO cache_meta(key,value) VALUES ('embedding_consistency','3')").run();
    })();
  }
  const insert = db.prepare("INSERT INTO memory_cache (id,title,content,project,status,updated_at,data_json) VALUES (?,?,?,?,?,?,?)");
  const insertFts = db.prepare("INSERT INTO memory_fts (id,title,content,project) VALUES (?,?,?,?)");
  const oldMemory = db.prepare("SELECT title,content FROM memory_cache WHERE id = ?");
  const deleteEmbedding = db.prepare("DELETE FROM semantic_embeddings WHERE memory_id = ?");
  const getMemory = db.prepare("SELECT id,title,content,project,status,updated_at AS updatedAt,data_json AS dataJson FROM memory_cache WHERE id = ?");
  let vectorExtensionLoaded = false;

  return {
    replaceAll(memories) {
      const transaction = db.transaction(() => {
        for (const memory of memories) {
          const old = oldMemory.get(memory.id) as { title: string; content: string } | undefined;
          if (old && (old.title !== memory.title || old.content !== memory.content)) deleteEmbedding.run(memory.id);
        }
        db.exec("DELETE FROM memory_fts; DELETE FROM memory_cache;");
        for (const memory of memories) {
          insert.run(memory.id, memory.title, memory.content, memory.project ?? null, memory.status, memory.updatedAt, memory.dataJson ?? null);
          insertFts.run(memory.id, memory.title, memory.content, memory.project ?? null);
        }
        db.exec("DELETE FROM semantic_embeddings WHERE memory_id NOT IN (SELECT id FROM memory_cache)");
        db.prepare("INSERT OR REPLACE INTO cache_meta (key,value) VALUES ('last_sync',?)").run(new Date().toISOString());
      });
      transaction();
    },
    search(query, project, limit = 25, status = "active") {
      const tokens = query.trim().split(/\s+/).filter(Boolean).slice(0, 20);
      if (!tokens.length) return [];
      const match = tokens.map(quoteFtsToken).join(" AND ");
      const statusClause = status === "all" ? "" : " AND c.status = ?";
      const projectClause = project ? " AND c.project = ?" : "";
      const params = [match, ...(status === "all" ? [] : [status]), ...(project ? [project] : []), Math.min(Math.max(limit, 1), 100)];
      return db.prepare(`
        SELECT c.id, c.title, c.content, c.project, c.status, c.updated_at AS updatedAt, c.data_json AS dataJson
        FROM memory_fts f JOIN memory_cache c ON c.id = f.id
        WHERE memory_fts MATCH ?${statusClause}${projectClause}
        ORDER BY bm25(memory_fts), c.updated_at DESC LIMIT ?
      `).all(...params) as CacheMemory[];
    },
    list(project) {
      const query = project
        ? "SELECT id,title,content,project,status,updated_at AS updatedAt,data_json AS dataJson FROM memory_cache WHERE project = ?"
        : "SELECT id,title,content,project,status,updated_at AS updatedAt,data_json AS dataJson FROM memory_cache";
      return db.prepare(query).all(...(project ? [project] : [])).map((row) => cacheRowSchema.parse(row));
    },
    getEmbedding(key) {
      const row: unknown = db.prepare("SELECT vector FROM semantic_embeddings WHERE memory_id = ? AND chunk_index = ? AND model = ? AND content_hash = ?")
        .get(key.memoryId, key.chunkIndex, key.model, key.contentHash);
      if (!row || typeof row !== "object" || !("vector" in row) || !Buffer.isBuffer(row.vector) || row.vector.length % 4 !== 0) return undefined;
      const vector = new Float32Array(row.vector.length / 4);
      for (let i = 0; i < vector.length; i++) vector[i] = row.vector.readFloatLE(i * 4);
      return vector;
    },
    setEmbedding(key, vector) {
      const bytes = Buffer.allocUnsafe(vector.length * 4);
      for (let i = 0; i < vector.length; i++) bytes.writeFloatLE(vector[i], i * 4);
      db.prepare("INSERT OR REPLACE INTO semantic_embeddings (memory_id,chunk_index,model,content_hash,vector) VALUES (?,?,?,?,?)")
        .run(key.memoryId, key.chunkIndex, key.model, key.contentHash, bytes);
    },
    hasMatchingRecords(options) {
      const filter = semanticFilter(options);
      return db.prepare(`SELECT 1 FROM memory_cache AS c WHERE 1 = 1${filter.sql} LIMIT 1`).get(...filter.params) !== undefined;
    },
    listMissingEmbeddings(model, width, options) {
      const filter = semanticFilter(options);
      return db.prepare(`
        SELECT c.id,c.title,c.content,c.project,c.status,c.updated_at AS updatedAt,c.data_json AS dataJson
        FROM memory_cache AS c
        WHERE (
          SELECT COUNT(*) FROM semantic_embeddings AS e
          WHERE e.memory_id = c.id AND e.model = ? AND length(e.vector) = ?
        ) < CASE WHEN length(c.content) <= ${SEMANTIC_CHUNK_SIZE} THEN 1
          ELSE 1 + (length(c.content) - ${SEMANTIC_CHUNK_SIZE} + ${SEMANTIC_CHUNK_STEP} - 1) / ${SEMANTIC_CHUNK_STEP} END${filter.sql}
      `).all(model, width * 4, ...filter.params).map((row) => cacheRowSchema.parse(row));
    },
    searchEmbeddingHits(model, vector, options, limit) {
      if (!vectorExtensionLoaded) { loadSqliteVec(db); vectorExtensionLoaded = true; }
      const filter = semanticFilter(options);
      const bytes = Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
      const rows = db.prepare(`
        SELECT e.memory_id AS id, e.chunk_index AS chunkIndex, MIN(vec_distance_cosine(e.vector, ?)) AS distance
        FROM semantic_embeddings AS e JOIN memory_cache AS c ON c.id = e.memory_id
        WHERE e.model = ? AND length(e.vector) = ?${filter.sql}
        GROUP BY e.memory_id ORDER BY distance${limit === undefined ? "" : " LIMIT ?"}
      `).all(bytes, model, vector.byteLength, ...filter.params, ...(limit === undefined ? [] : [limit])) as Array<{ id: string; chunkIndex: number; distance: number }>;
      return rows.filter((row) => row.distance <= 1 - MIN_SIMILARITY)
        .map((row) => ({ id: row.id, chunkIndex: row.chunkIndex }));
    },
    getById(id) {
      const row = getMemory.get(id);
      return row ? cacheRowSchema.parse(row) : undefined;
    },
    count() {
      const row = db.prepare("SELECT COUNT(*) AS count FROM memory_cache").get() as { count: number };
      return Number(row.count);
    },
    isFresh(maxAgeMs = 5 * 60 * 1000) {
      const row = db.prepare("SELECT value FROM cache_meta WHERE key = 'last_sync'").get() as { value?: string } | undefined;
      const timestamp = row?.value ? Date.parse(row.value) : NaN;
      return Number.isFinite(timestamp) && Date.now() - timestamp <= maxAgeMs;
    },
    clear() { db.exec("DELETE FROM memory_fts; DELETE FROM memory_cache; DELETE FROM cache_meta; DELETE FROM semantic_embeddings;"); },
    close() { db.close(); },
  };
}

export function cachePath(): string {
  loadDotEnv();
  const configured = process.env.MEMORY_CACHE_PATH?.trim();
  if (configured) {
    if (!isAbsolute(configured)) throw new Error("MEMORY_CACHE_PATH must be an absolute path");
    return configured;
  }
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", ".cache", "memory.sqlite");
}

export function cacheInput(memory: Memory): CacheMemory {
  return { id: memory.id, title: memory.title, content: memory.content, project: memory.project, status: memory.status, updatedAt: memory.updatedAt, dataJson: JSON.stringify(memory) };
}

export function memoryFromCache(row: CacheMemory): Memory | undefined {
  if (!row.dataJson) return undefined;
  try { return JSON.parse(row.dataJson) as Memory; } catch { return undefined; }
}
