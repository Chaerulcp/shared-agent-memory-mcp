import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
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
  search(query: string, project?: string, limit?: number): CacheMemory[];
  count(): number;
  isFresh(maxAgeMs?: number): boolean;
  clear(): void;
  close(): void;
}

function quoteFtsToken(token: string): string {
  return `"${token.replaceAll('"', '""')}"`;
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
        db.prepare("INSERT OR REPLACE INTO cache_meta (key,value) VALUES ('last_sync',?)").run(new Date().toISOString());
      });
      transaction();
    },
    search(query, project, limit = 25) {
      const tokens = query.trim().split(/\s+/).filter(Boolean).slice(0, 20);
      if (!tokens.length) return [];
      const match = tokens.map(quoteFtsToken).join(" AND ");
      const projectClause = project ? " AND c.project = ?" : "";
      const params = project ? [match, project, Math.min(Math.max(limit, 1), 100)] : [match, Math.min(Math.max(limit, 1), 100)];
      return db.prepare(`
        SELECT c.id, c.title, c.content, c.project, c.status, c.updated_at AS updatedAt, c.data_json AS dataJson
        FROM memory_fts f JOIN memory_cache c ON c.id = f.id
        WHERE memory_fts MATCH ? AND c.status = 'active'${projectClause}
        ORDER BY bm25(memory_fts), c.updated_at DESC LIMIT ?
      `).all(...params) as CacheMemory[];
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
    clear() { db.exec("DELETE FROM memory_fts; DELETE FROM memory_cache; DELETE FROM cache_meta;"); },
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
