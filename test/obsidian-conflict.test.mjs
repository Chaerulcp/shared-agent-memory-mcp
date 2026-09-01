import test from "node:test";
import assert from "node:assert/strict";
import { contentHash, hasManualChange, isConflict } from "../dist/obsidian-conflict.js";

test("contentHash is deterministic and changes with content", () => {
  assert.equal(contentHash("same"), contentHash("same"));
  assert.notEqual(contentHash("same"), contentHash("changed"));
});

test("hasManualChange distinguishes unchanged and edited files", () => {
  const synced = "Notion version";
  assert.equal(hasManualChange(synced, contentHash(synced)), false);
  assert.equal(hasManualChange("Manual edit", contentHash(synced)), true);
  assert.equal(hasManualChange("Any file", undefined), false);
  assert.equal(isConflict("Legacy file", undefined), true);
  assert.equal(isConflict(synced, contentHash(synced)), false);
});

test("conflict copy naming is stable", () => {
  assert.equal("memory.md".replace(/\.md$/, ".conflict.md"), "memory.conflict.md");
});
