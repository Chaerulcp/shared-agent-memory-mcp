import test from "node:test";
import assert from "node:assert/strict";
import { relativeManifestPath } from "../dist/obsidian.js";

test("relativeManifestPath never stores an absolute vault path", () => {
  assert.equal(
    relativeManifestPath(
      "C:/Users/CHAERUL/Documents/ObsidianVault",
      "C:\\Users\\CHAERUL\\Documents\\ObsidianVault\\memories\\decision\\note.md"
    ),
    "memories/decision/note.md"
  );
});
