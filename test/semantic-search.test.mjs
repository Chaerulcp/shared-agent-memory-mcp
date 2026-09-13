import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMemoryCache, cacheInput } from "../dist/cache.js";
import { searchSemanticCache } from "../dist/semantic-search.js";

test("semantic cache ranks matching vectors from a fresh snapshot", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agent-memory-semantic-"));
  const path = join(dir, "memory.sqlite");
  const memories = [
    { id: "car", title: "Car repair", content: "Replace the brake pads", project: "garage" },
    { id: "banana", title: "Banana recipe", content: "Bake a loaf", project: "garage" },
  ].map((item) => ({
    ...item,
    agent: "shared", category: "context", tags: [], importance: "medium",
    status: "active", url: "", createdAt: "2026-01-01", updatedAt: "2026-01-01",
  }));
  const cache = createMemoryCache(path);
  try {
    cache.replaceAll(memories.map(cacheInput));
  } finally {
    cache.close();
  }

  const embed = async (texts) => texts.map((text) =>
    /automobile|car/i.test(text) ? Float32Array.of(1, 0) : Float32Array.of(0, 1)
  );
  try {
    const results = await searchSemanticCache(
      { query: "automobile maintenance", project: "garage", limit: 1 },
      path,
      embed,
    );
    assert.deepEqual(results.map((memory) => memory.id), ["car"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("semantic cache re-embeds a memory after its content changes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agent-memory-semantic-update-"));
  const path = join(dir, "memory.sqlite");
  const memory = {
    id: "note", title: "Service note", content: "Car maintenance", project: "garage",
    agent: "shared", category: "context", tags: [], importance: "medium",
    status: "active", url: "", createdAt: "2026-01-01", updatedAt: "2026-01-01",
  };
  const embed = async (texts) => texts.map((text) =>
    /automobile|car/i.test(text) ? Float32Array.of(1, 0) : Float32Array.of(0, 1)
  );
  try {
    const cache = createMemoryCache(path);
    cache.replaceAll([cacheInput(memory)]);
    cache.close();
    const options = { query: "automobile maintenance", mode: "semantic" };
    assert.deepEqual((await searchSemanticCache(options, path, embed)).map((item) => item.id), ["note"]);

    const updated = createMemoryCache(path);
    updated.replaceAll([cacheInput({ ...memory, content: "Banana bread" })]);
    updated.close();
    assert.deepEqual(await searchSemanticCache(options, path, embed), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("hybrid cache retains an exact keyword match when vector similarity is low", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agent-memory-hybrid-"));
  const path = join(dir, "memory.sqlite");
  const memory = {
    id: "security", title: "Encryption key", content: "Rotate keys every quarter", project: "api",
    agent: "shared", category: "convention", tags: [], importance: "high",
    status: "active", url: "", createdAt: "2026-01-01", updatedAt: "2026-01-01",
  };
  const embed = async (texts) => texts.map((text) =>
    text === "encryption key" ? Float32Array.of(1, 0) : Float32Array.of(0, 1)
  );
  try {
    const cache = createMemoryCache(path);
    cache.replaceAll([cacheInput(memory)]);
    cache.close();
    const results = await searchSemanticCache({ query: "encryption key", mode: "hybrid" }, path, embed);
    assert.deepEqual(results.map((item) => item.id), ["security"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("semantic cache reuses stored memory vectors across queries", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agent-memory-semantic-reuse-"));
  const path = join(dir, "memory.sqlite");
  const memory = {
    id: "car", title: "Car repair", content: "Replace brake pads", project: "garage",
    agent: "shared", category: "context", tags: [], importance: "medium",
    status: "active", url: "", createdAt: "2026-01-01", updatedAt: "2026-01-01",
  };
  let embeddedTexts = 0;
  const embed = async (texts) => {
    embeddedTexts += texts.length;
    return texts.map(() => Float32Array.of(1, 0));
  };
  try {
    const cache = createMemoryCache(path);
    cache.replaceAll([cacheInput(memory)]);
    cache.close();
    await searchSemanticCache({ query: "automobile" }, path, embed);
    await searchSemanticCache({ query: "vehicle" }, path, embed);
    assert.equal(embeddedTexts, 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("hybrid all mode includes exact keyword matches from archived memories", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agent-memory-hybrid-archived-"));
  const path = join(dir, "memory.sqlite");
  const memory = {
    id: "archived-security", title: "Encryption key", content: "Rotate keys every quarter", project: "api",
    agent: "shared", category: "convention", tags: [], importance: "high",
    status: "archived", url: "", createdAt: "2026-01-01", updatedAt: "2026-01-01",
  };
  const embed = async (texts) => texts.map((text) =>
    text === "encryption key" ? Float32Array.of(1, 0) : Float32Array.of(0, 1)
  );
  try {
    const cache = createMemoryCache(path);
    cache.replaceAll([cacheInput(memory)]);
    cache.close();
    const results = await searchSemanticCache({ query: "encryption key", mode: "hybrid", status: "all" }, path, embed);
    assert.deepEqual(results.map((item) => item.id), ["archived-security"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
