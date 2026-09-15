import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { loadConfig } from "./config.js";
import { checkAuth, checkDatabase, listAll } from "./store.js";
import { cachePath, createMemoryCache } from "./cache.js";
import { listConflictFiles, vaultPath } from "./obsidian.js";

export interface DoctorCheck { name: string; ok: boolean; detail: string; }
export interface DoctorSummary { healthy: boolean; failed: number; checks: DoctorCheck[]; }

export function summarizeDoctorChecks(checks: DoctorCheck[]): DoctorSummary {
  const failed = checks.filter((check) => !check.ok).length;
  return { healthy: failed === 0, failed, checks };
}

function check(name: string, ok: boolean, detail: string): DoctorCheck { return { name, ok, detail }; }

function manifestCheck(): DoctorCheck {
  const file = join(vaultPath(), ".shared-agent-memory-sync.json");
  if (!existsSync(file)) return check("Manifest", false, "missing");
  try {
    const manifest = JSON.parse(readFileSync(file, "utf8")) as Record<string, { path?: string }>;
    const paths = Object.values(manifest).map((entry) => entry.path ?? "");
    const absolute = paths.filter((path) => /^[A-Za-z]:[\\/]|^\//.test(path)).length;
    return check("Manifest", absolute === 0, `${paths.length} entries; absolute paths: ${absolute}`);
  } catch { return check("Manifest", false, "invalid JSON"); }
}

function gitCheck(): DoctorCheck {
  try {
    const status = execFileSync("git", ["status", "--porcelain"], { cwd: vaultPath(), encoding: "utf8" }).trim();
    return check("Git working tree", !status, status ? "dirty" : "clean");
  } catch (err) { return check("Git working tree", false, err instanceof Error ? err.message : String(err)); }
}

export function watcherCheck(): DoctorCheck {
  const lock = join(vaultPath(), ".shared-agent-memory-watch.lock");
  if (!existsSync(lock)) return check("Watcher", true, "not running (optional)");
  const rawPid = readFileSync(lock, "utf8").trim();
  const pid = Number(rawPid);
  if (!Number.isSafeInteger(pid) || pid <= 0) return check("Watcher", false, `invalid PID ${rawPid}`);
  try {
    process.kill(pid, 0);
    return check("Watcher", true, `active PID ${pid}`);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EPERM") return check("Watcher", true, `active PID ${pid}`);
    return check("Watcher", false, `stale PID ${pid}`);
  }
}

export async function runDoctorSync(): Promise<DoctorSummary> {
  const checks: DoctorCheck[] = [];
  const cfg = loadConfig();
  checks.push(check("Notion configuration", Boolean(cfg.notionToken && cfg.databaseId), cfg.notionToken && cfg.databaseId ? "configured" : "missing token or database ID"));
  if (cfg.notionToken) {
    try { checks.push(check("Notion connection", true, await checkAuth())); }
    catch (err) { checks.push(check("Notion connection", false, err instanceof Error ? err.message : String(err))); }
    if (cfg.databaseId) {
      const db = await checkDatabase();
      checks.push(check("Notion database", db.ok, db.message));
      try { const memories = await listAll(); checks.push(check("Notion memories", true, `${memories.length} records`)); }
      catch (err) { checks.push(check("Notion memories", false, err instanceof Error ? err.message : String(err))); }
    }
  }
  const vault = vaultPath();
  checks.push(check("Vault", existsSync(vault), existsSync(vault) ? vault : "missing"));
  if (existsSync(vault)) {
    checks.push(manifestCheck());
    const conflicts = listConflictFiles();
    checks.push(check("Conflicts", conflicts.length === 0, `${conflicts.length} active conflict copies`));
    checks.push(gitCheck());
    checks.push(watcherCheck());
  }
  const cache = createMemoryCache();
  try { checks.push(check("Cache", cache.isFresh(), `${cache.count()} records; ${cache.isFresh() ? "fresh" : "stale"}; ${cachePath()}`)); }
  finally { cache.close(); }
  return summarizeDoctorChecks(checks);
}

export function formatDoctorSummary(summary: DoctorSummary): string {
  const lines = ["== Agent Memory — doctor --sync =="];
  for (const item of summary.checks) lines.push(`${item.ok ? "OK" : "FAIL"}  ${item.name}: ${item.detail}`);
  lines.push(`Overall: ${summary.healthy ? "HEALTHY" : "UNHEALTHY"}`);
  return lines.join("\n");
}
