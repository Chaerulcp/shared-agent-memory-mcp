import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { cachePath } from "../dist/cache.js";

test("cache path is stable across client working directories and accepts an absolute override", (t) => {
  const originalCwd = process.cwd();
  const originalPath = process.env.MEMORY_CACHE_PATH;
  const otherCwd = mkdtempSync(join(tmpdir(), "agent-memory-cwd-"));
  t.after(() => {
    process.chdir(originalCwd);
    if (originalPath === undefined) delete process.env.MEMORY_CACHE_PATH;
    else process.env.MEMORY_CACHE_PATH = originalPath;
    const rel = relative(resolve(tmpdir()), resolve(otherCwd));
    if (rel && !rel.startsWith("..") && !isAbsolute(rel)) rmSync(otherCwd, { recursive: true, force: true });
  });
  delete process.env.MEMORY_CACHE_PATH;
  const defaultPath = cachePath();
  process.chdir(otherCwd);
  assert.equal(cachePath(), defaultPath);
  assert.equal(isAbsolute(defaultPath), true);
  process.env.MEMORY_CACHE_PATH = join(otherCwd, "custom.sqlite");
  assert.equal(cachePath(), join(otherCwd, "custom.sqlite"));
  process.env.MEMORY_CACHE_PATH = "relative.sqlite";
  assert.throws(() => cachePath(), /absolute/);
});

test("MCP server advertises the package version", async () => {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");
  const { resolve } = await import("node:path");
  const packageVersion = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
  const client = new Client({ name: "version-test", version: "1.0.0" });
  const transport = new StdioClientTransport({ command: process.execPath, args: [resolve("dist/index.js")], stderr: "pipe" });
  try {
    await client.connect(transport);
    assert.equal(client.getServerVersion()?.version, packageVersion);
  } finally {
    await client.close();
  }
});
