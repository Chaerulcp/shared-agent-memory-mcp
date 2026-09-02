import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { archiveMemoryFile } from "../dist/obsidian.js";

const dashed = "11111111-2222-3333-4444-555555555555";
const compact = dashed.replaceAll("-", "");
const body = `---\nid: ${dashed}\ntitle: "Temporary"\n---\n\n# Temporary\n`;

for (const [name, id] of [["compact", compact], ["dashed", dashed]]) {
  test(`archiveMemoryFile matches ${name} Notion IDs to dashed frontmatter IDs`, () => {
    const vault = mkdtempSync(join(tmpdir(), `agent-memory-id-${name}-`));
    mkdirSync(join(vault, "memories", "task"), { recursive: true });
    writeFileSync(join(vault, "memories", "task", "temporary.md"), body);
    writeFileSync(join(vault, ".shared-agent-memory-sync.json"), JSON.stringify({
      [compact]: { path: "memories/task/temporary.md", hash: "hash" },
    }));
    process.env.OBSIDIAN_VAULT_PATH = vault;

    archiveMemoryFile(id);

    assert.equal(existsSync(join(vault, "memories", "task", "temporary.md")), false);
    assert.equal(existsSync(join(vault, "memories", "_archived", "temporary.md")), true);
    const manifest = JSON.parse(readFileSync(join(vault, ".shared-agent-memory-sync.json"), "utf8"));
    assert.equal(manifest[compact], undefined);
  });
}
