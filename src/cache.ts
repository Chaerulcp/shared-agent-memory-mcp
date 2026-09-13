import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { z } from "zod";
import type { Memory } from "./store.js";

export interface CacheMemory {
  id: string;
  title: string;
  content: string;
  project?: string;
  status: string;
  updatedAt: string;
  dataJson?: string;
}

export interface MemoryCache {
  replaceAll(memories: CacheMemory[]): void;
  search(query: string, project?: string, limit?: number, status?: string): CacheMemory[];
  list(project?: string): CacheMemory[];
  getEmbedding(id: string, model: string, contentHash: string): Float32Array | undefined;
  setEmbedding(id: string, model: string, contentHash: string, vector: Float32Array): void;
  count(): number;
  isFresh(maxAgeMs?: number): boolean;
  clear(): void;
  close(): void;
}

function quoteFtsToken(token: string): string {
  return `"${token.replaceAll('"', '""')}"`;
}

const cacheRowSchema = z.object({
  id: z.string(), title: z.string(), content: z.string(),
  project: z.string().nullable().transform((value) => value ?? undefined),
  status: z.string(), updatedAt: z.string(),
  dataJson: z.string().nullable().transform((value) => value ?? undefined),
});

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
      memory_id TEXT PRIMARY KEY, model TEXT NOT NULL,
      content_hash TEXT NOT NULL, vector BLOB NOT NULL
    );
  `);
  const columns = db.prepare("PRAGMA table_info(memory_cache)").all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "data_json")) db.exec("ALTER TABLE memory_cache ADD COLUMN data_json TEXT");
  const insert = db.prepare("INSERT INTO memory_cache (id,title,content,project,status,updated_at,data_json) VALUES (?,?,?,?,?,?,?)");
  const insertFts = db.prepare("INSERT INTO memory_fts (id,title,content,project) VALUES (?,?,?,?)");

  return {
    replaceAll(memories) {
      const transaction = db.transaction(() => {
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
    getEmbedding(id, model, contentHash) {
      const row: unknown = db.prepare("SELECT vector FROM semantic_embeddings WHERE memory_id = ? AND model = ? AND content_hash = ?").get(id, model, contentHash);
      if (!row || typeof row !== "object" || !("vector" in row) || !Buffer.isBuffer(row.vector) || row.vector.length % 4 !== 0) return undefined;
      const vector = new Float32Array(row.vector.length / 4);
      for (let i = 0; i < vector.length; i++) vector[i] = row.vector.readFloatLE(i * 4);
      return vector;
    },
    setEmbedding(id, model, contentHash, vector) {
      const bytes = Buffer.allocUnsafe(vector.length * 4);
      for (let i = 0; i < vector.length; i++) bytes.writeFloatLE(vector[i], i * 4);
      db.prepare("INSERT OR REPLACE INTO semantic_embeddings (memory_id,model,content_hash,vector) VALUES (?,?,?,?)").run(id, model, contentHash, bytes);
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
  return resolve(process.cwd(), ".cache", "memory.sqlite");
}

export function cacheInput(memory: Memory): CacheMemory {
  return { id: memory.id, title: memory.title, content: memory.content, project: memory.project, status: memory.status, updatedAt: memory.updatedAt, dataJson: JSON.stringify(memory) };
}

export function memoryFromCache(row: CacheMemory): Memory | undefined {
  if (!row.dataJson) return undefined;
  try { return JSON.parse(row.dataJson) as Memory; } catch { return undefined; }
}
