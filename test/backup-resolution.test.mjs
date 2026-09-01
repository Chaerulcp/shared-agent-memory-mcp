import test from "node:test";
import assert from "node:assert/strict";
import { backupRelativePath, conflictResolutionTarget, isSafeVaultRelativePath } from "../dist/obsidian-conflict.js";

test("backupRelativePath keeps vault paths under a timestamped backup directory", () => {
  assert.equal(backupRelativePath("memories/task/example.md", "2026-09-01T120000Z"), "backups/2026-09-01T120000Z/memories/task/example.md");
});

test("conflict resolution targets the original file", () => {
  assert.equal(conflictResolutionTarget("memories/task/example.md.conflict.md"), "memories/task/example.md");
});

test("vault relative path validation rejects traversal and absolute paths", () => {
  assert.equal(isSafeVaultRelativePath("memories/task/example.md"), true);
  assert.equal(isSafeVaultRelativePath("../outside.md"), false);
  assert.equal(isSafeVaultRelativePath("C:/outside.md"), false);
});
