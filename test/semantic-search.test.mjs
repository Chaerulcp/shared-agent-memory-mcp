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
    assert.deepEqual(results[0].match, { excerpt: "Replace the brake pads", start: 0, end: 22 });
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
    assert.equal(results[0].match, undefined);
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

test("semantic cache applies metadata filters before ranking nearest vectors", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agent-memory-semantic-filter-"));
  const path = join(dir, "memory.sqlite");
  const base = {
    agent: "shared", category: "context", tags: [], importance: "medium",
    status: "active", url: "", createdAt: "2026-01-01", updatedAt: "2026-01-01",
  };
  const memories = [
    { ...base, id: "wrong-project", title: "Exact car", content: "car", project: "other" },
    { ...base, id: "archived", title: "Exact car", content: "car", project: "garage", status: "archived" },
    { ...base, id: "wrong-agent", title: "Exact car", content: "car", project: "garage", agent: "bot" },
    { ...base, id: "wrong-category", title: "Exact car", content: "car", project: "garage", category: "decision" },
    { ...base, id: "wrong-tag", title: "Exact car", content: "car", project: "garage", tags: ["old"] },
    { ...base, id: "eligible", title: "Related vehicle", content: "vehicle", project: "garage", tags: ["service"] },
  ];
  const embed = async (texts) => texts.map((text) =>
    /exact car|automobile/i.test(text) ? Float32Array.of(1, 0) : Float32Array.of(0.7, 0.7)
  );
  try {
    const cache = createMemoryCache(path);
    cache.replaceAll(memories.map(cacheInput));
    cache.close();
    const results = await searchSemanticCache({
      query: "automobile", project: "garage", agent: "shared", category: "context", tag: "service",
      limit: 5,
    }, path, embed);
    assert.deepEqual(results.map((item) => item.id), ["eligible"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("semantic cache returns no results before loading the model when filters match nothing", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agent-memory-semantic-empty-"));
  const path = join(dir, "memory.sqlite");
  try {
    const cache = createMemoryCache(path);
    cache.replaceAll([cacheInput({
      id: "note", title: "Example", content: "Example", project: "other",
      agent: "shared", category: "context", tags: [], importance: "medium",
      status: "active", url: "", createdAt: "2026-01-01", updatedAt: "2026-01-01",
    })]);
    cache.close();
    const results = await searchSemanticCache({ query: "example", project: "missing" }, path, async () => {
      throw new Error("embedding should not run");
    });
    assert.deepEqual(results, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("semantic cache retrieves a fact near the end of a long memory", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agent-memory-semantic-tail-"));
  const path = join(dir, "memory.sqlite");
  const content = `${"Garden watering schedule. ".repeat(70)}Rotate deployment keys weekly.`;
  try {
    const cache = createMemoryCache(path);
    cache.replaceAll([cacheInput({
      id: "long-note", title: "Operational notes", content,
      project: "ops", agent: "shared", category: "context", tags: [], importance: "medium",
      status: "active", url: "", createdAt: "2026-01-01", updatedAt: "2026-01-01",
    })]);
    cache.close();
    const embed = async (texts) => texts.map((text) =>
      /rotate deployment keys|key rotation/i.test(text) ? Float32Array.of(1, 0) : Float32Array.of(0, 1)
    );
    const results = await searchSemanticCache({ query: "key rotation", project: "ops" }, path, embed);
    assert.deepEqual(results.map((memory) => memory.id), ["long-note"]);
    assert.deepEqual(results[0].match, {
      excerpt: Array.from(content).slice(1000).join(""),
      start: 1000,
      end: Array.from(content).length,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
