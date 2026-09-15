import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { cacheInput, createMemoryCache } from "../dist/cache.js";

test("memory_search returns compact excerpts when response is compact", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "agent-memory-mcp-compact-"));
  t.after(() => {
    const rel = relative(resolve(tmpdir()), resolve(root));
    if (rel && !rel.startsWith("..") && !isAbsolute(rel)) rmSync(root, { recursive: true, force: true });
  });
  const path = join(root, "memory.sqlite");
  const content = `${"Additional operational notes. ".repeat(80)}Keep API keys in the secret manager.`;
  const cache = createMemoryCache(path);
  cache.replaceAll([cacheInput({
    id: "security-note", title: "API key storage", content, project: "compact-qa",
    agent: "shared", category: "convention", tags: [], importance: "high",
    status: "active", url: "", createdAt: "2026-09-15", updatedAt: "2026-09-15",
  })]);
  cache.close();

  const client = new Client({ name: "compact-search-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve("dist/index.js")],
    env: { ...process.env, MEMORY_CACHE_PATH: path },
    stderr: "pipe",
  });
  try {
    await client.connect(transport);
    const compact = await client.callTool({ name: "memory_search", arguments: {
      query: "secret manager", project: "compact-qa", response: "compact",
    } });
    assert.notEqual(compact.isError, true);
    const payload = JSON.parse(compact.content[0].text);
    assert.equal(payload.count, 1);
    assert.equal(payload.results[0].id, "security-note");
    assert.equal(payload.results[0].content, undefined);
    assert.match(payload.results[0].excerpt, /secret manager/);
    assert.ok(Array.from(payload.results[0].excerpt).length <= 240);

    const titleOnly = await client.callTool({ name: "memory_search", arguments: {
      query: "storage", project: "compact-qa", response: "compact",
    } });
    assert.notEqual(titleOnly.isError, true);
    assert.equal(JSON.parse(titleOnly.content[0].text).results[0].excerpt, Array.from(content).slice(0, 240).join(""));

    const full = await client.callTool({ name: "memory_search", arguments: {
      query: "secret manager", project: "compact-qa",
    } });
    assert.notEqual(full.isError, true);
    assert.equal(JSON.parse(full.content[0].text).results[0].content, content);
  } finally {
    await client.close();
  }
});
