import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { contentHash } from "../dist/obsidian-conflict.js";
import { archiveMemoryFile, archiveMissingMemoryFiles, gitAutoSync, resolveConflict, syncMemoryFile } from "../dist/obsidian.js";

const memory = {
  id: "11111111-2222-3333-4444-555555555555",
  title: "Memory sync",
  content: "Notion version",
  agent: "shared",
  category: "task",
  tags: [],
  importance: "medium",
  status: "active",
  url: "",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

test("Git sync commits only managed vault files and reports unpushed commits", async () => {
  const vault = mkdtempSync(join(tmpdir(), "agent-memory-git-"));
  process.env.OBSIDIAN_VAULT_PATH = vault;
  execFileSync("git", ["init", "-q", vault]);
  execFileSync("git", ["config", "user.name", "Memory Test"], { cwd: vault });
  execFileSync("git", ["config", "user.email", "memory@example.test"], { cwd: vault });
  writeFileSync(join(vault, "notes.md"), "Unrelated note\n");
  execFileSync("git", ["add", "notes.md"], { cwd: vault });
  mkdirSync(join(vault, "memories"), { recursive: true });
  writeFileSync(join(vault, "memories", "personal.md"), `---\ntitle: Personal note\n---\n\nExample ID:\nid: ${memory.id}\n`);
  writeFileSync(join(vault, "memories", "private.txt"), "Unrelated private file\n");
  const mirror = syncMemoryFile(memory);

  const result = await gitAutoSync("sync: test");

  assert.equal(result.status, "pending-push");
  assert.equal(existsSync(mirror.path), true);
  const committed = execFileSync("git", ["show", "--pretty=format:", "--name-only", "HEAD"], { cwd: vault, encoding: "utf8" });
  assert.match(committed, /memories\/task\//);
  assert.match(committed, /\.shared-agent-memory-sync\.json/);
  assert.doesNotMatch(committed, /notes\.md/);
  assert.doesNotMatch(committed, /personal\.md|private\.txt/);
  assert.match(execFileSync("git", ["diff", "--cached", "--name-only"], { cwd: vault, encoding: "utf8" }), /notes\.md/);

  const remote = mkdtempSync(join(tmpdir(), "agent-memory-remote-"));
  execFileSync("git", ["init", "--bare", "-q", remote]);
  execFileSync("git", ["remote", "add", "origin", remote], { cwd: vault });
  execFileSync("git", ["config", "push.autoSetupRemote", "true"], { cwd: vault });
  assert.equal((await gitAutoSync("sync: retry push")).status, "pushed");
  assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { cwd: vault, encoding: "utf8" }).trim(),
    execFileSync("git", ["--git-dir", remote, "rev-parse", "HEAD"], { encoding: "utf8" }).trim());
});

test("Git commit failure is reported while the mirrored file remains intact", async () => {
  const vault = mkdtempSync(join(tmpdir(), "agent-memory-git-fail-"));
  process.env.OBSIDIAN_VAULT_PATH = vault;
  execFileSync("git", ["init", "-q", vault]);
  execFileSync("git", ["config", "user.name", "Memory Test"], { cwd: vault });
  execFileSync("git", ["config", "user.email", "memory@example.test"], { cwd: vault });
  const hooks = join(vault, "hooks");
  mkdirSync(hooks);
  writeFileSync(join(hooks, "pre-commit"), "#!/bin/sh\nexit 1\n");
  execFileSync("git", ["config", "core.hooksPath", hooks], { cwd: vault });
  const mirror = syncMemoryFile(memory);

  const result = await gitAutoSync("sync: blocked commit");

  assert.equal(result.status, "failed");
  assert.equal(existsSync(mirror.path), true);
  assert.match(readFileSync(mirror.path, "utf8"), /Notion version/);
});

test("Git sync records deletion of a tracked legacy memory file", async () => {
  const vault = mkdtempSync(join(tmpdir(), "agent-memory-git-delete-"));
  process.env.OBSIDIAN_VAULT_PATH = vault;
  execFileSync("git", ["init", "-q", vault]);
  execFileSync("git", ["config", "user.name", "Memory Test"], { cwd: vault });
  execFileSync("git", ["config", "user.email", "memory@example.test"], { cwd: vault });
  const dir = join(vault, "memories", "task");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "legacy.md"), `---\nid: ${memory.id}\n---\n\nLegacy memory\n`);
  writeFileSync(join(vault, ".shared-agent-memory-sync.json"), JSON.stringify({ [memory.id]: { path: "memories/task/legacy.md", hash: "old" } }));
  execFileSync("git", ["add", "memories", ".shared-agent-memory-sync.json"], { cwd: vault });
  execFileSync("git", ["commit", "-qm", "baseline"], { cwd: vault });

  archiveMemoryFile(memory.id, true);
  const result = await gitAutoSync("delete legacy memory");

  assert.equal(result.status, "pending-push");
  const changes = execFileSync("git", ["show", "--pretty=format:", "--name-status", "HEAD"], { cwd: vault, encoding: "utf8" });
  assert.match(changes, /D\s+memories\/task\/legacy\.md/);
});

test("conflict keeps manual file, updates Notion copy, and accept-notion clears manifest conflict", () => {
  const vault = mkdtempSync(join(tmpdir(), "agent-memory-conflict-"));
  process.env.OBSIDIAN_VAULT_PATH = vault;
  const first = syncMemoryFile(memory);
  const original = readFileSync(first.path, "utf8");
  writeFileSync(first.path, `${original}\nManual Obsidian edit\n`);
  const updated = { ...memory, content: "New Notion version" };
  const conflict = syncMemoryFile(updated);
  assert.equal(readFileSync(first.path, "utf8"), `${original}\nManual Obsidian edit\n`);
  assert.match(readFileSync(conflict.conflict, "utf8"), /New Notion version/);

  syncMemoryFile({ ...memory, content: "Latest Notion version" });
  assert.match(readFileSync(conflict.conflict, "utf8"), /Latest Notion version/);
  const relativeConflict = conflict.conflict.slice(vault.length + 1).replaceAll("\\", "/");
  const resolved = resolveConflict(relativeConflict, "accept-notion");
  assert.equal(existsSync(resolved.backup), true);
  assert.match(readFileSync(resolved.backup, "utf8"), /Manual Obsidian edit/);
  assert.equal(existsSync(conflict.conflict), false);
  const manifest = JSON.parse(readFileSync(join(vault, ".shared-agent-memory-sync.json"), "utf8"));
  assert.equal(manifest[memory.id].hash, contentHash(readFileSync(first.path, "utf8")));
  assert.equal(syncMemoryFile({ ...memory, content: "Latest Notion version" }).conflict, undefined);
});

test("active sync does not reuse an archived file with the same Notion ID", () => {
  const vault = mkdtempSync(join(tmpdir(), "agent-memory-archive-lookup-"));
  process.env.OBSIDIAN_VAULT_PATH = vault;
  const archivedDir = join(vault, "memories", "_archived");
  mkdirSync(archivedDir, { recursive: true });
  const archived = join(archivedDir, "old.md");
  writeFileSync(archived, `---\nid: ${memory.id}\n---\n\nArchived manual note\n`);

  const result = syncMemoryFile(memory);

  assert.equal(result.conflict, undefined);
  assert.equal(existsSync(archived), true);
  assert.match(readFileSync(archived, "utf8"), /Archived manual note/);
  assert.match(readFileSync(result.path, "utf8"), /Notion version/);
});

test("orphan reconciliation preserves a personal note with an ID in its body", () => {
  const vault = mkdtempSync(join(tmpdir(), "agent-memory-personal-note-"));
  process.env.OBSIDIAN_VAULT_PATH = vault;
  const dir = join(vault, "memories");
  mkdirSync(dir, { recursive: true });
  const note = join(dir, "personal.md");
  writeFileSync(note, `---\ntitle: Personal note\n---\n\nid: ${memory.id}\n`);

  const archived = archiveMissingMemoryFiles(new Set());

  assert.deepEqual(archived, []);
  assert.equal(existsSync(note), true);
});
