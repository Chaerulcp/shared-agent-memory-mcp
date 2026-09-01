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
}

export interface MemoryCache {
  replaceAll(memories: CacheMemory[]): void;
  search(query: string, limit?: number): CacheMemory[];
  count(): number;
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
      project TEXT, status TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
      id UNINDEXED, title, content, project UNINDEXED
    );
  `);
  const insert = db.prepare("INSERT INTO memory_cache (id,title,content,project,status,updated_at) VALUES (?,?,?,?,?,?)");
  const insertFts = db.prepare("INSERT INTO memory_fts (id,title,content,project) VALUES (?,?,?,?)");

  return {
    replaceAll(memories) {
      const transaction = db.transaction(() => {
        db.exec("DELETE FROM memory_fts; DELETE FROM memory_cache;");
        for (const memory of memories) {
          insert.run(memory.id, memory.title, memory.content, memory.project ?? null, memory.status, memory.updatedAt);
          insertFts.run(memory.id, memory.title, memory.content, memory.project ?? null);
        }
      });
      transaction();
    },
    search(query, limit = 25) {
      const tokens = query.trim().split(/\s+/).filter(Boolean).slice(0, 20);
      if (!tokens.length) return [];
      const match = tokens.map(quoteFtsToken).join(" AND ");
      return db.prepare(`
        SELECT c.id, c.title, c.content, c.project, c.status, c.updated_at AS updatedAt
        FROM memory_fts f JOIN memory_cache c ON c.id = f.id
        WHERE memory_fts MATCH ? AND c.status = 'active'
        ORDER BY bm25(memory_fts), c.updated_at DESC LIMIT ?
      `).all(match, Math.min(Math.max(limit, 1), 100)) as CacheMemory[];
    },
    count() {
      const row = db.prepare("SELECT COUNT(*) AS count FROM memory_cache").get() as { count: number };
      return Number(row.count);
    },
    clear() { db.exec("DELETE FROM memory_fts; DELETE FROM memory_cache;"); },
    close() { db.close(); },
  };
}

export function cachePath(): string {
  return resolve(process.cwd(), ".cache", "memory.sqlite");
}

export function cacheInput(memory: Memory): CacheMemory {
  return { id: memory.id, title: memory.title, content: memory.content, project: memory.project, status: memory.status, updatedAt: memory.updatedAt };
}
