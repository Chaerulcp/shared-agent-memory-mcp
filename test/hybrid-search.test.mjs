import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryCache } from "../dist/cache.js";

test("cache snapshot is fresh immediately after rebuild", () => {
  const cache = createMemoryCache(":memory:");
  cache.replaceAll([{ id: "1", title: "Decision", content: "Use SQLite", status: "active", updatedAt: "2026-09-01" }]);
  assert.equal(cache.isFresh(60_000), true);
  cache.close();
});

test("cache search can filter by project", () => {
  const cache = createMemoryCache(":memory:");
  cache.replaceAll([
    { id: "1", title: "Deploy", content: "Deploy CRM", project: "crm", status: "active", updatedAt: "2026-09-01" },
    { id: "2", title: "Deploy", content: "Deploy shop", project: "shop", status: "active", updatedAt: "2026-09-01" },
  ]);
  assert.deepEqual(cache.search("Deploy", "crm").map((item) => item.id), ["1"]);
  cache.close();
});
