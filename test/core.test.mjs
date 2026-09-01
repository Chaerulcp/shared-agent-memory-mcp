import test from "node:test";
import assert from "node:assert/strict";
import { chunkText } from "../dist/store.js";
import { watcherLockPath } from "../dist/obsidian.js";
import { runSetup } from "../dist/setup.js";

test("setup dry-run returns success for a configured project", async () => {
  const originalCwd = process.cwd();
  process.chdir("C:/Dev/shared-agent-memory-mcp");
  try {
    const result = await runSetup({ dryRun: true });
    assert.equal(result, 0);
  } finally {
    process.chdir(originalCwd);
  }
});



test("chunkText keeps short content intact", () => {
  assert.deepEqual(chunkText("short text", 20), ["short text"]);
});

test("chunkText splits long content without losing characters", () => {
  const input = "alpha beta gamma delta epsilon";
  const chunks = chunkText(input, 12);
  assert.equal(chunks.join(""), input);
  assert.ok(chunks.every((chunk) => chunk.length <= 12));
});

test("watcher lock path is inside the configured vault", () => {
  assert.match(watcherLockPath("C:/vault"), /C:[\\/]vault/);
  assert.match(watcherLockPath("C:/vault"), /\.shared-agent-memory-watch\.lock$/);
});
