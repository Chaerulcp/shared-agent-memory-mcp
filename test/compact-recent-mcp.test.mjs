import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test("memory_recent scopes compact results to the requested project", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "agent-memory-mcp-recent-"));
  t.after(() => {
    const rel = relative(resolve(tmpdir()), resolve(root));
    if (rel && !rel.startsWith("..") && !isAbsolute(rel)) rmSync(root, { recursive: true, force: true });
  });
  const preload = join(root, "mock-notion.cjs");
  const id = "11111111-2222-3333-4444-555555555555";
  const content = `Keep API keys in the secret manager. ${"Additional operational notes. ".repeat(80)}`;
  const page = {
    id, url: "https://notion.example.test/page",
    created_time: "2026-09-15T00:00:00Z", last_edited_time: "2026-09-15T00:00:00Z",
    properties: {
      Name: { title: [{ plain_text: "API key storage" }] },
      Content: { rich_text: [{ plain_text: content }] },
      Agent: { select: { name: "shared" } },
      Category: { select: { name: "convention" } },
      Tags: { multi_select: [] },
      Importance: { select: { name: "high" } },
      Status: { select: { name: "active" } },
      Project: { rich_text: [{ plain_text: "project-alpha" }] },
    },
  };
  const otherPage = {
    ...page,
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    properties: {
      ...page.properties,
      Name: { title: [{ plain_text: "Other project memory" }] },
      Project: { rich_text: [{ plain_text: "project-beta" }] },
    },
  };
  const prefixPage = {
    ...otherPage,
    id: "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
    properties: {
      ...otherPage.properties,
      Project: { rich_text: [{ plain_text: "project-alpha-extra" }] },
    },
  };
  const packageUrl = pathToFileURL(resolve("package.json")).href;
  writeFileSync(preload, `
    const { createRequire } = require("node:module");
    const { Client } = createRequire(${JSON.stringify(packageUrl)})("@notionhq/client");
    const pages = ${JSON.stringify([page, otherPage, prefixPage])};
    Client.prototype.request = async function ({ path, method, body }) {
      if (path.endsWith("/query")) {
        const filter = body.filter?.and?.find((item) => item.property === "Project")?.rich_text;
        const results = filter?.equals
          ? pages.filter((page) => page.properties.Project.rich_text[0].plain_text === filter.equals)
          : filter?.contains
            ? pages.filter((page) => page.properties.Project.rich_text[0].plain_text.includes(filter.contains))
            : pages;
        return { results, has_more: false };
      }
      if (method === "get") return { properties: { Project: { rich_text: {} } } };
      throw new Error("Unexpected Notion request: " + method + " " + path);
    };
  `);

  const client = new Client({ name: "compact-recent-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--require", preload, resolve("dist/index.js")],
    cwd: root,
    env: {
      ...process.env,
      NOTION_TOKEN: "test-token",
      NOTION_DATABASE_ID: id,
      MEMORY_CACHE_PATH: join(root, "memory.sqlite"),
      AGENT_PROJECT: "project-alpha",
    },
    stderr: "pipe",
  });
  try {
    await client.connect(transport);
    const compact = await client.callTool({ name: "memory_recent", arguments: { response: "compact", project: "project-alpha" } });
    assert.notEqual(compact.isError, true);
    const payload = JSON.parse(compact.content[0].text);
    assert.equal(payload.count, 1);
    assert.equal(payload.results[0].id, id);
    assert.equal(payload.results[0].content, undefined);
    assert.equal(payload.results[0].excerpt, content.slice(0, 240));

    const current = await client.callTool({ name: "memory_recent", arguments: { response: "compact", currentProject: true } });
    assert.notEqual(current.isError, true);
    assert.deepEqual(JSON.parse(current.content[0].text).results.map((memory) => memory.id), [id]);

    const explicit = await client.callTool({ name: "memory_recent", arguments: { project: "project-beta", currentProject: true } });
    assert.notEqual(explicit.isError, true);
    assert.deepEqual(JSON.parse(explicit.content[0].text).results.map((memory) => memory.id), [otherPage.id]);

    const full = await client.callTool({ name: "memory_recent", arguments: {} });
    assert.notEqual(full.isError, true);
    const fullPayload = JSON.parse(full.content[0].text);
    assert.equal(fullPayload.count, 3);
    assert.equal(fullPayload.results[0].content, content);
  } finally {
    await client.close();
  }
});
