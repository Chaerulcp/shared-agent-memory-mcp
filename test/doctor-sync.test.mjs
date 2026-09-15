import test from "node:test";
import assert from "node:assert/strict";
import { summarizeDoctorChecks } from "../dist/doctor.js";
import { watcherCheck } from "../dist/doctor.js";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";

test("summarizeDoctorChecks reports healthy when every check passes", () => {
  const result = summarizeDoctorChecks([
    { name: "Notion connection", ok: true, detail: "OK" },
    { name: "Vault", ok: true, detail: "OK" },
    { name: "Manifest", ok: true, detail: "47 entries" },
    { name: "Conflicts", ok: true, detail: "0" },
  ]);
  assert.equal(result.healthy, true);
  assert.equal(result.failed, 0);
});

test("summarizeDoctorChecks reports unhealthy when one check fails", () => {
  const result = summarizeDoctorChecks([
    { name: "Notion connection", ok: true, detail: "OK" },
    { name: "Manifest", ok: false, detail: "absolute path" },
  ]);
  assert.equal(result.healthy, false);
  assert.equal(result.failed, 1);
});

test("watcher check treats an absent optional watcher as healthy and detects live or stale locks", (t) => {
  const vault = mkdtempSync(join(tmpdir(), "agent-memory-doctor-"));
  const originalVault = process.env.OBSIDIAN_VAULT_PATH;
  process.env.OBSIDIAN_VAULT_PATH = vault;
  t.after(() => {
    if (originalVault === undefined) delete process.env.OBSIDIAN_VAULT_PATH;
    else process.env.OBSIDIAN_VAULT_PATH = originalVault;
    const rel = relative(resolve(tmpdir()), resolve(vault));
    if (rel && !rel.startsWith("..") && !isAbsolute(rel)) rmSync(vault, { recursive: true, force: true });
  });
  assert.deepEqual(watcherCheck(), { name: "Watcher", ok: true, detail: "not running (optional)" });
  const lock = join(vault, ".shared-agent-memory-watch.lock");
  writeFileSync(lock, `${process.pid}\n`);
  assert.deepEqual(watcherCheck(), { name: "Watcher", ok: true, detail: `active PID ${process.pid}` });
  writeFileSync(lock, "invalid\n");
  assert.deepEqual(watcherCheck(), { name: "Watcher", ok: false, detail: "invalid PID invalid" });
  writeFileSync(lock, "999999999\n");
  assert.deepEqual(watcherCheck(), { name: "Watcher", ok: false, detail: "stale PID 999999999" });
});
