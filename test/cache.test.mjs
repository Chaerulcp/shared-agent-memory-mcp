import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryCache } from "../dist/cache.js";

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
