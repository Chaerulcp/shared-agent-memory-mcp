import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { z } from "zod";
import { cachePath } from "./cache.js";

const rowSchema = z.object({ fingerprint: z.string(), page_id: z.string().nullable() });

export class OperationKeyConflictError extends Error {
  constructor() {
    super("Idempotency key sudah dipakai untuk isi memori yang berbeda.");
    this.name = "OperationKeyConflictError";
  }
}

export class OperationPendingError extends Error {
  constructor(cause?: unknown) {
    super("Hasil penulisan Notion belum pasti. Ulangi dengan idempotency key yang sama setelah halaman muncul di Notion; jangan gunakan key baru untuk operasi ini.", { cause });
    this.name = "OperationPendingError";
  }
}

export class OperationSchemaError extends Error {
  constructor() {
    super('Properti Notion "Operation Key" harus bertipe rich_text.');
    this.name = "OperationSchemaError";
  }
}

export function openOperationJournal(path = `${cachePath()}.operations.sqlite`) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec("CREATE TABLE IF NOT EXISTS operations (key TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, page_id TEXT)");
  const insert = db.prepare("INSERT OR IGNORE INTO operations (key, fingerprint, page_id) VALUES (?, ?, NULL)");
  const get = db.prepare("SELECT fingerprint, page_id FROM operations WHERE key = ?");
  const complete = db.prepare("UPDATE operations SET page_id = ? WHERE key = ?");
  return {
    claim(key: string, fingerprint: string): "new" | "pending" | "complete" {
      const result = insert.run(key, fingerprint);
      const row = rowSchema.parse(get.get(key));
      if (row.fingerprint !== fingerprint) throw new OperationKeyConflictError();
      if (result.changes === 1) return "new";
      return row.page_id ? "complete" : "pending";
    },
    complete(key: string, pageId: string): void {
      complete.run(pageId, key);
    },
    close(): void { db.close(); },
  };
}
