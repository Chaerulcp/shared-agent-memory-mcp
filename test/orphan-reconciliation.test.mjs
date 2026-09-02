import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { archiveMissingMemoryFiles } from "../dist/obsidian.js";

const id = "11111111-2222-3333-4444-555555555555";

test("archiveMissingMemoryFiles archives manifest entries absent from active source", () => {
  const vault = mkdtempSync(join(tmpdir(), "agent-memory-orphan-"));
  mkdirSync(join(vault, "memories", "task"), { recursive: true });
  writeFileSync(join(vault, "memories", "task", "temporary.md"), `---\nid: ${id}\n---\n`);
  writeFileSync(join(vault, ".shared-agent-memory-sync.json"), JSON.stringify({
    [id.replaceAll("-", "")]: { path: "memories/task/temporary.md", hash: "hash" },
  }));
  process.env.OBSIDIAN_VAULT_PATH = vault;

  const archived = archiveMissingMemoryFiles(new Set());

  assert.equal(archived.length, 1);
  assert.equal(existsSync(join(vault, "memories", "task", "temporary.md")), false);
  assert.equal(existsSync(join(vault, "memories", "_archived", "temporary.md")), true);
  const manifest = JSON.parse(readFileSync(join(vault, ".shared-agent-memory-sync.json"), "utf8"));
  assert.deepEqual(manifest, {});
});

test("archiveMissingMemoryFiles removes stale conflict copies for absent source records", () => {
  const vault = mkdtempSync(join(tmpdir(), "agent-memory-orphan-conflict-"));
  mkdirSync(join(vault, "memories", "task"), { recursive: true });
  const conflict = join(vault, "memories", "task", "temporary.md.conflict.md");
  writeFileSync(conflict, `---\nid: ${id}\n---\n`);
  writeFileSync(join(vault, ".shared-agent-memory-sync.json"), "{}");
  process.env.OBSIDIAN_VAULT_PATH = vault;

  archiveMissingMemoryFiles(new Set());

  assert.equal(existsSync(conflict), false);
  assert.equal(existsSync(join(vault, "memories", "_archived", "temporary.md.conflict.md")), false);
});
