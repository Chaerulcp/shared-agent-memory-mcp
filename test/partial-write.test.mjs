import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { Client } from "@notionhq/client";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { addMemory, deleteMemory, searchMemories, updateMemory } from "../dist/store.js";

const id = "11111111-2222-3333-4444-555555555555";
const page = {
  id,
  url: "https://notion.example.test/page",
  created_time: "2026-01-01T00:00:00Z",
  last_edited_time: "2026-01-01T00:00:00Z",
  properties: {
    Name: { title: [{ plain_text: "Notion write" }] },
    Content: { rich_text: [{ plain_text: "Saved in Notion" }] },
    Agent: { select: { name: "shared" } },
    Category: { select: { name: "task" } },
    Tags: { multi_select: [] },
    Importance: { select: { name: "medium" } },
    Status: { select: { name: "active" } },
  },
};

test("successful Notion writes report a failed Obsidian mirror without inviting a duplicate retry", async (t) => {
  const vault = mkdtempSync(join(tmpdir(), "agent-memory-partial-write-"));
  const originalCwd = process.cwd();
  const originalEnv = {
    NOTION_TOKEN: process.env.NOTION_TOKEN,
    NOTION_DATABASE_ID: process.env.NOTION_DATABASE_ID,
    NOTION_DATA_SOURCE_ID: process.env.NOTION_DATA_SOURCE_ID,
    OBSIDIAN_VAULT_PATH: process.env.OBSIDIAN_VAULT_PATH,
    MEMORY_CACHE_PATH: process.env.MEMORY_CACHE_PATH,
  };
  t.after(() => {
    process.chdir(originalCwd);
    for (const [name, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    const rel = relative(resolve(tmpdir()), resolve(vault));
    if (rel && !rel.startsWith("..") && !isAbsolute(rel)) rmSync(vault, { recursive: true, force: true });
  });
  process.chdir(vault);
  process.env.NOTION_TOKEN = "test-token";
  process.env.NOTION_DATABASE_ID = id;
  process.env.NOTION_DATA_SOURCE_ID = id;
  process.env.OBSIDIAN_VAULT_PATH = vault;
  process.env.MEMORY_CACHE_PATH = join(vault, ".cache", "memory.sqlite");
  writeFileSync(join(vault, "memories"), "A file blocks the mirror directory");

  const calls = [];
  t.mock.method(Client.prototype, "request", async ({ path, method }) => {
    calls.push({ path, method });
    if (method === "get") return { properties: {} };
    return page;
  });

  const added = await addMemory({ title: "Notion write", content: "Saved in Notion", agent: "shared", allowDuplicate: true, project: "test" });
  assert.equal(added.memory.id, id);
  assert.match(added.mirrorError, /ENOTDIR/);
  assert.equal(calls.filter((call) => call.method === "post").length, 1);

  const updated = await updateMemory(id, { title: "Updated title" });
  assert.equal(updated.memory.id, id);
  assert.match(updated.mirrorError, /ENOTDIR/);

  const deleted = await deleteMemory(id);
  assert.match(deleted.mirrorError, /ENOTDIR/);
  assert.equal(calls.filter((call) => call.method === "patch").length, 2);
});

test("successful Notion add reports cache invalidation failure and searches Notion instead", async (t) => {
  const vault = mkdtempSync(join(tmpdir(), "agent-memory-cache-fail-"));
  const originalCwd = process.cwd();
  const originalEnv = {
    NOTION_TOKEN: process.env.NOTION_TOKEN,
    NOTION_DATABASE_ID: process.env.NOTION_DATABASE_ID,
    NOTION_DATA_SOURCE_ID: process.env.NOTION_DATA_SOURCE_ID,
    OBSIDIAN_VAULT_PATH: process.env.OBSIDIAN_VAULT_PATH,
    MEMORY_CACHE_PATH: process.env.MEMORY_CACHE_PATH,
  };
  t.after(() => {
    process.chdir(originalCwd);
    for (const [name, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    const rel = relative(resolve(tmpdir()), resolve(vault));
    if (rel && !rel.startsWith("..") && !isAbsolute(rel)) rmSync(vault, { recursive: true, force: true });
  });
  process.chdir(vault);
  process.env.NOTION_TOKEN = "test-token";
  process.env.NOTION_DATABASE_ID = id;
  process.env.NOTION_DATA_SOURCE_ID = id;
  process.env.OBSIDIAN_VAULT_PATH = join(vault, "missing-vault");
  process.env.MEMORY_CACHE_PATH = join(vault, ".cache", "memory.sqlite");
  writeFileSync(join(vault, ".cache"), "A file blocks the cache directory");
  const calls = [];
  t.mock.method(Client.prototype, "request", async ({ path, method }) => {
    calls.push({ path, method });
    if (method === "get") return { properties: {} };
    if (path.endsWith("/query")) return { results: [page] };
    return page;
  });

  const added = await addMemory({ title: "Notion write", content: "Saved in Notion", agent: "shared", allowDuplicate: true, project: "test" });
  assert.equal(added.memory.id, id);
  assert.match(added.cacheError, /EEXIST/);
  const results = await searchMemories({ query: "Notion write" });
  assert.deepEqual(results.map((memory) => memory.id), [id]);
  assert.equal(calls.filter((call) => call.path.endsWith("/query")).length, 1);
});

test("CLI and MCP report Notion success and the Obsidian failure separately", async (t) => {
  const vault = mkdtempSync(join(tmpdir(), "agent-memory-cli-partial-"));
  const rel = relative(resolve(tmpdir()), resolve(vault));
  t.after(() => {
    if (rel && !rel.startsWith("..") && !isAbsolute(rel)) rmSync(vault, { recursive: true, force: true });
  });
  writeFileSync(join(vault, "memories"), "A file blocks the mirror directory");
  writeFileSync(join(vault, ".cache"), "A file blocks the cache directory");
  const preload = join(vault, "mock-notion.cjs");
  const packageUrl = pathToFileURL(resolve("package.json")).href;
  writeFileSync(preload, `
    const { createRequire } = require("node:module");
    const appRequire = createRequire(${JSON.stringify(packageUrl)});
    const { Client } = appRequire("@notionhq/client");
    Client.prototype.request = async function ({ path, method }) {
      if (method === "get") return { properties: {} };
      if (path.endsWith("/query")) return { results: [] };
      return ${JSON.stringify(page)};
    };
  `);
  const result = spawnSync(process.execPath, [
    "--require", preload,
    resolve("dist", "cli.js"),
    "add", "--title", "Notion write", "--content", "Saved in Notion", "--agent", "shared", "--project", "test",
  ], {
    cwd: vault,
    env: { ...process.env, NOTION_TOKEN: "test-token", NOTION_DATABASE_ID: id, NOTION_DATA_SOURCE_ID: id, OBSIDIAN_VAULT_PATH: vault, MEMORY_CACHE_PATH: join(vault, ".cache", "memory.sqlite") },
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Memori tersimpan/);
  assert.match(result.stdout, new RegExp(id));
  assert.match(result.stderr, /Notion tersimpan, tetapi mirror Obsidian gagal: ENOTDIR/);
  assert.match(result.stderr, /Notion tersimpan, tetapi cache lokal gagal dibersihkan: EEXIST/);

  const client = new McpClient({ name: "partial-write-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--require", preload, resolve("dist", "index.js")],
    cwd: vault,
    env: { ...process.env, NOTION_TOKEN: "test-token", NOTION_DATABASE_ID: id, NOTION_DATA_SOURCE_ID: id, OBSIDIAN_VAULT_PATH: vault, MEMORY_CACHE_PATH: join(vault, ".cache", "memory.sqlite") },
    stderr: "pipe",
  });
  try {
    await client.connect(transport);
    const response = await client.callTool({
      name: "memory_add",
      arguments: { title: "Notion write", content: "Saved in Notion", agent: "shared", allowDuplicate: true },
    });
    assert.notEqual(response.isError, true);
    const payload = JSON.parse(response.content[0].text);
    assert.equal(payload.saved, true);
    assert.equal(payload.memory.id, id);
    assert.match(payload.obsidian.error, /ENOTDIR/);
    assert.match(payload.cache.error, /EEXIST/);
  } finally {
    await client.close();
  }
});
