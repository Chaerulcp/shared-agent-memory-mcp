import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import Database from "better-sqlite3";
import { createMemoryCache } from "../dist/cache.js";

test("legacy single-vector cache migrates to chunk storage", () => {
  const root = mkdtempSync(join(tmpdir(), "agent-memory-chunk-migration-"));
  const path = join(root, "memory.sqlite");
  try {
    const legacy = new Database(path);
    legacy.exec(`CREATE TABLE semantic_embeddings (
      memory_id TEXT PRIMARY KEY, model TEXT NOT NULL,
      content_hash TEXT NOT NULL, vector BLOB NOT NULL
    )`);
    legacy.prepare("INSERT INTO semantic_embeddings VALUES (?,?,?,?)")
      .run("note", "old", "old", Buffer.from(Float32Array.of(1, 0).buffer));
    legacy.close();

    const cache = createMemoryCache(path);
    cache.replaceAll([{ id: "note", title: "Long note", content: "Long note", project: "alpha", status: "active", updatedAt: "2026-01-01" }]);
    const first = { memoryId: "note", chunkIndex: 0, model: "new", contentHash: "first" };
    const second = { memoryId: "note", chunkIndex: 1, model: "new", contentHash: "second" };
    cache.setEmbedding(first, Float32Array.of(1, 0));
    cache.setEmbedding(second, Float32Array.of(0, 1));
    assert.deepEqual(cache.searchEmbeddingHits("new", Float32Array.of(0, 1), { project: "alpha" }, 5), [{ id: "note", chunkIndex: 1 }]);
    cache.close();
  } finally {
    const rel = relative(resolve(tmpdir()), resolve(root));
    if (rel && !rel.startsWith("..") && !isAbsolute(rel)) rmSync(root, { recursive: true, force: true });
  }
});

test("vector SQL ranks only eligible cached memories", () => {
  const cache = createMemoryCache(":memory:");
  try {
    cache.replaceAll([
      { id: "archived", title: "Old", content: "Old", project: "alpha", status: "archived", updatedAt: "2026-01-01" },
      { id: "active", title: "Current", content: "Current", project: "alpha", status: "active", updatedAt: "2026-01-01" },
    ]);
    cache.setEmbedding({ memoryId: "archived", chunkIndex: 0, model: "test", contentHash: "one" }, Float32Array.of(1, 0));
    cache.setEmbedding({ memoryId: "active", chunkIndex: 0, model: "test", contentHash: "two" }, Float32Array.of(0.7, 0.7));
    assert.deepEqual(cache.searchEmbeddingHits("test", Float32Array.of(1, 0), { project: "alpha" }, 5), [{ id: "active", chunkIndex: 0 }]);
  } finally {
    cache.close();
  }
});

test("FTS5 cache indexes and searches memories", () => {
  const cache = createMemoryCache(":memory:");
  cache.replaceAll([
    { id: "1", title: "Laravel deployment", content: "Use Vite in the CRM project", project: "crm", status: "active", updatedAt: "2026-09-01" },
    { id: "2", title: "Obsidian sync", content: "Mirror Notion to Markdown", project: "memory", status: "active", updatedAt: "2026-09-01" },
  ]);
  const results = cache.search("Laravel CRM");
  assert.equal(results.length, 1);
  assert.equal(results[0].id, "1");
  cache.close();
});

test("FTS5 cache can be rebuilt and cleared", () => {
  const cache = createMemoryCache(":memory:");
  cache.replaceAll([{ id: "1", title: "Old", content: "text", status: "active", updatedAt: "2026-09-01" }]);
  assert.equal(cache.count(), 1);
  cache.clear();
  assert.equal(cache.count(), 0);
  cache.close();
});
