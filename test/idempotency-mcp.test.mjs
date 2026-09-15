import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test("MCP memory_add returns the same page after a lost Notion response", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "agent-memory-mcp-idempotency-"));
  const preload = join(root, "mock-notion.cjs");
  const countFile = join(root, "creates.txt");
  const id = "11111111-2222-3333-4444-555555555555";
  const key = "mcp-retry-operation-123";
  const page = {
    id,
    url: "https://notion.example.test/page",
    created_time: "2026-01-01T00:00:00Z",
    last_edited_time: "2026-01-01T00:00:00Z",
    properties: {
      Name: { title: [{ plain_text: "Retry-safe memory" }] },
      Content: { rich_text: [{ plain_text: "A durable fact" }] },
      Agent: { select: { name: "shared" } },
      Category: { select: { name: "other" } },
      Tags: { multi_select: [] },
      Importance: { select: { name: "medium" } },
      Status: { select: { name: "active" } },
      Project: { rich_text: [{ plain_text: "test" }] },
      "Operation Key": { rich_text: [{ plain_text: key }] },
    },
  };
  const packageUrl = pathToFileURL(resolve("package.json")).href;
  writeFileSync(preload, `
    const { createRequire } = require("node:module");
    const { writeFileSync } = require("node:fs");
    const { Client } = createRequire(${JSON.stringify(packageUrl)})("@notionhq/client");
    const page = ${JSON.stringify(page)};
    let saved = false;
    let creates = 0;
    Client.prototype.request = async function ({ path, method }) {
      if (path.endsWith("/query")) return { results: saved ? [page] : [], has_more: false };
      if (path.startsWith("data_sources/")) return { properties: { "Operation Key": { rich_text: {} }, Project: { rich_text: {} } } };
      if (method === "get") return page;
      if (method === "post" && path === "pages") {
        creates++;
        writeFileSync(${JSON.stringify(countFile)}, String(creates));
        saved = true;
        throw new Error("socket closed after commit");
      }
      throw new Error("Unexpected Notion request: " + method + " " + path);
    };
  `);
  t.after(() => {
    const rel = relative(resolve(tmpdir()), resolve(root));
    if (rel && !rel.startsWith("..") && !isAbsolute(rel)) rmSync(root, { recursive: true, force: true });
  });

  const client = new McpClient({ name: "idempotency-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--require", preload, resolve("dist/index.js")],
    cwd: root,
    env: {
      ...process.env,
      NOTION_TOKEN: "test-token",
      NOTION_DATABASE_ID: id,
      NOTION_DATA_SOURCE_ID: id,
      OBSIDIAN_VAULT_PATH: join(root, "absent-vault"),
      MEMORY_CACHE_PATH: join(root, "memory.sqlite"),
    },
    stderr: "pipe",
  });
  try {
    await client.connect(transport);
    const args = { title: "Retry-safe memory", content: "A durable fact", agent: "shared", project: "test", allowDuplicate: true, idempotencyKey: key };
    const first = await client.callTool({ name: "memory_add", arguments: args });
    const retry = await client.callTool({ name: "memory_add", arguments: args });
    for (const response of [first, retry]) {
      assert.notEqual(response.isError, true);
      const payload = JSON.parse(response.content[0].text);
      assert.equal(payload.memory.id, id);
      assert.equal(payload.replayed, true);
    }
    assert.equal(readFileSync(countFile, "utf8"), "1");
  } finally {
    await client.close();
  }
});
