import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@notionhq/client";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { addMemory } from "../dist/store.js";

const id = "11111111-2222-3333-4444-555555555555";
const key = "test-operation-123";
const input = { title: "Retry-safe memory", content: "A durable fact", agent: "shared", project: "test", allowDuplicate: true, idempotencyKey: key };
const page = {
  id,
  url: "https://notion.example.test/page",
  created_time: "2026-01-01T00:00:00Z",
  last_edited_time: "2026-01-01T00:00:00Z",
  properties: {
    Name: { title: [{ plain_text: input.title }] },
    Content: { rich_text: [{ plain_text: input.content }] },
    Agent: { select: { name: input.agent } },
    Category: { select: { name: "other" } },
    Tags: { multi_select: [] },
    Importance: { select: { name: "medium" } },
    Status: { select: { name: "active" } },
    Project: { rich_text: [{ plain_text: input.project }] },
    "Operation Key": { rich_text: [{ plain_text: key }] },
  },
};

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "agent-memory-idempotency-"));
  const original = {
    NOTION_TOKEN: process.env.NOTION_TOKEN,
    NOTION_DATABASE_ID: process.env.NOTION_DATABASE_ID,
    NOTION_DATA_SOURCE_ID: process.env.NOTION_DATA_SOURCE_ID,
    OBSIDIAN_VAULT_PATH: process.env.OBSIDIAN_VAULT_PATH,
    MEMORY_CACHE_PATH: process.env.MEMORY_CACHE_PATH,
  };
  process.env.NOTION_TOKEN = "test-token";
  process.env.NOTION_DATABASE_ID = id;
  process.env.NOTION_DATA_SOURCE_ID = id;
  process.env.OBSIDIAN_VAULT_PATH = join(root, "absent-vault");
  process.env.MEMORY_CACHE_PATH = join(root, "memory.sqlite");
  t.after(() => {
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    const rel = relative(resolve(tmpdir()), resolve(root));
    if (rel && !rel.startsWith("..") && !isAbsolute(rel)) rmSync(root, { recursive: true, force: true });
  });
}

test("memory_add reuses a Notion page when the create response is lost", async (t) => {
  fixture(t);
  let saved = false;
  let creates = 0;
  t.mock.method(Client.prototype, "request", async ({ path, method, body }) => {
    if (path.endsWith("/query")) {
      assert.equal(path, `data_sources/${id.replaceAll("-", "")}/query`);
      return { results: saved ? [page] : [], has_more: false };
    }
    if (path.startsWith("data_sources/")) return { properties: { "Operation Key": { rich_text: {} }, Project: { rich_text: {} } } };
    if (method === "get") return page;
    if (method === "post" && path === "pages") {
      creates++;
      assert.deepEqual(body.parent, { type: "data_source_id", data_source_id: id.replaceAll("-", "") });
      assert.equal(body.properties["Operation Key"].rich_text[0].text.content, key);
      saved = true;
      throw new Error("socket closed after commit");
    }
    throw new Error(`Unexpected Notion request: ${method} ${path}`);
  });

  const first = await addMemory(input);
  assert.equal(first.memory.id, id);
  assert.equal(first.replayed, true);
  const retry = await addMemory(input);
  assert.equal(retry.memory.id, id);
  assert.equal(retry.replayed, true);
  assert.equal(creates, 1);
});

test("memory_add does not issue a second create while an earlier outcome is unknown", async (t) => {
  fixture(t);
  let creates = 0;
  t.mock.method(Client.prototype, "request", async ({ path, method }) => {
    if (path.endsWith("/query")) return { results: [], has_more: false };
    if (path.startsWith("data_sources/")) return { properties: { "Operation Key": { rich_text: {} } } };
    if (method === "post" && path === "pages") {
      creates++;
      throw new Error("socket closed after commit");
    }
    throw new Error(`Unexpected Notion request: ${method} ${path}`);
  });

  await assert.rejects(addMemory(input));
  await assert.rejects(addMemory(input));
  assert.equal(creates, 1);
});

test("memory_add rejects a reused key with different content even without a local journal", async (t) => {
  fixture(t);
  t.mock.method(Client.prototype, "request", async ({ path, method }) => {
    if (path.endsWith("/query")) return { results: [page], has_more: false };
    if (path.startsWith("data_sources/")) return { properties: { "Operation Key": { rich_text: {} } } };
    if (method === "get") return page;
    throw new Error(`Unexpected Notion request: ${method} ${path}`);
  });

  await assert.rejects(addMemory({ ...input, content: "A different fact" }), { name: "OperationKeyConflictError" });
});

test("memory_add provisions the Operation Key property before its first keyed write", async (t) => {
  fixture(t);
  let provisioned = false;
  let updates = 0;
  t.mock.method(Client.prototype, "request", async ({ path, method, body }) => {
    if (path.endsWith("/query")) return { results: [], has_more: false };
    if (method === "patch" && path.startsWith("data_sources/")) {
      assert.deepEqual(body.properties["Operation Key"], { rich_text: {} });
      updates++;
      provisioned = true;
      return { properties: { "Operation Key": { rich_text: {} } } };
    }
    if (path.startsWith("data_sources/")) return { properties: provisioned ? { "Operation Key": { rich_text: {} } } : {} };
    if (method === "post" && path === "pages") return page;
    throw new Error(`Unexpected Notion request: ${method} ${path}`);
  });

  const result = await addMemory(input);
  assert.equal(result.memory.id, id);
  assert.equal(updates, 1);
});
