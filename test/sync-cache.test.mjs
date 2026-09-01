import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryCache } from "../dist/cache.js";
import { syncCacheForMemories } from "../dist/store.js";

const memories = [
  { id: "1", title: "Laravel CRM", content: "Use Vite", status: "active", updatedAt: "2026-09-01" },
];

test("sync cache dry-run does not write cache", () => {
  assert.equal(syncCacheForMemories(memories, true, ":memory:"), 0);
});

test("normal sync cache writes all memories", () => {
  assert.equal(syncCacheForMemories(memories, false, ":memory:"), 1);
});
