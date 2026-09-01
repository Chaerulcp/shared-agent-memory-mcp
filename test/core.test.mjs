import test from "node:test";
import assert from "node:assert/strict";
import { chunkText } from "../dist/store.js";
import { watcherLockPath } from "../dist/obsidian.js";



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
