import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { archiveMemoryFile } from "../dist/obsidian.js";

const id = "11111111-2222-3333-4444-555555555555";
const body = `---\nid: ${id}\ntitle: "Temporary"\n---\n\n# Temporary\n`;

test("archiveMemoryFile moves active file and removes its manifest entry", () => {
  const vault = mkdtempSync(join(tmpdir(), "agent-memory-archive-"));
  mkdirSync(join(vault, "memories", "task"), { recursive: true });
  writeFileSync(join(vault, "memories", "task", "temporary.md"), body);
  writeFileSync(join(vault, ".shared-agent-memory-sync.json"), JSON.stringify({
    [id]: { path: "memories/task/temporary.md", hash: "hash" },
  }));
  process.env.OBSIDIAN_VAULT_PATH = vault;

  archiveMemoryFile(id);

  assert.equal(existsSync(join(vault, "memories", "task", "temporary.md")), false);
  assert.equal(existsSync(join(vault, "memories", "_archived", "temporary.md")), true);
  const manifest = JSON.parse(readFileSync(join(vault, ".shared-agent-memory-sync.json"), "utf8"));
  assert.equal(manifest[id], undefined);
});
