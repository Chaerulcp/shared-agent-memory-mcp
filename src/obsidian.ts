/**
 * Penyimpanan kedua: vault Obsidian (Markdown lokal + git sync).
 * Setiap memori Notion juga ditulis sebagai file .md di vault agar
 * Obsidian menjadi sumber pengetahuan kedua yang bisa dibaca semua agent.
 */
import { execFile, execFileSync } from "node:child_process";
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { backupRelativePath, buildSyncManifest, conflictResolutionTarget, contentHash, isConflict, isSafeVaultRelativePath, type SyncManifest } from "./obsidian-conflict.js";
import type { Memory } from "./store.js";

const MANIFEST_FILE = ".shared-agent-memory-sync.json";

function manifestPath(): string { return join(vaultPath(), MANIFEST_FILE); }
export function relativeManifestPath(vault: string, file: string): string {
  const root = vault.replace(/\\/g, "/").replace(/\/$/, "");
  const normalized = file.replace(/\\/g, "/");
  const rootLower = root.toLowerCase();
  const normalizedLower = normalized.toLowerCase();
  if (normalizedLower.startsWith(`${rootLower}/`)) return normalized.slice(root.length + 1);
  const candidate = relative(root, normalized).replace(/\\/g, "/");
  return !isAbsolute(candidate) && candidate !== "" && !candidate.startsWith("../") ? candidate : normalized;
}

function relativeVaultPath(file: string): string {
  return relativeManifestPath(vaultPath(), file);
}

function backupFile(file: string): string {
  const relative = relativeVaultPath(file);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = join(vaultPath(), backupRelativePath(relative, stamp));
  mkdirSync(join(target, ".."), { recursive: true });
  copyFileSync(file, target);
  return target;
}

export function listConflictFiles(): string[] {
  if (!vaultEnabled()) return [];
  const root = join(vaultPath(), MEM_DIR);
  const out: string[] = [];
  if (!existsSync(root)) return out;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) { stack.push(full); continue; }
      if (entry.name.endsWith(".conflict.md")) out.push(relativeVaultPath(full));
    }
  }
  return out.sort();
}

export function resolveConflict(conflictFile: string, action: "accept-notion" | "keep-obsidian"): { target: string; backup?: string } {
  const relative = conflictFile.replace(/\\/g, "/");
  if (!isSafeVaultRelativePath(relative) || !relative.startsWith(`${MEM_DIR}/`) || !relative.endsWith(".conflict.md")) throw new Error("Conflict path tidak valid");
  const conflict = join(vaultPath(), relative);
  const targetRelative = conflictResolutionTarget(relative);
  const target = join(vaultPath(), targetRelative);
  if (!existsSync(conflict) || !existsSync(target)) throw new Error("Conflict atau file target tidak ditemukan");
  if (action === "accept-notion") {
    const backup = backupFile(target);
    copyFileSync(conflict, target);
    rmSync(conflict);
    return { target, backup };
  }
  rmSync(conflict);
  return { target };
}

function readManifest(): SyncManifest {
  try { return JSON.parse(readFileSync(manifestPath(), "utf8")) as SyncManifest; } catch { return {}; }
}
function writeManifest(manifest: SyncManifest): void {
  writeFileSync(manifestPath(), JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

function removeManifestEntry(manifest: SyncManifest, id: string): void {
  const normalized = id.replace(/-/g, "").toLowerCase();
  for (const key of Object.keys(manifest)) {
    if (key.replace(/-/g, "").toLowerCase() === normalized) delete manifest[key];
  }
}

export function initSyncBaseline(force = false): { path: string; count: number } {
  if (!vaultEnabled()) throw new Error(`Obsidian vault tidak ditemukan: ${vaultPath()}`);
  if (!existsSync(join(vaultPath(), ".git"))) throw new Error("Vault Obsidian harus berupa repository Git.");
  if (!force && existsSync(manifestPath())) throw new Error("Manifest sudah ada. Gunakan --force untuk membangun ulang.");
  if (!force) {
    const status = execFileSync("git", ["status", "--porcelain"], { cwd: vaultPath(), encoding: "utf8" });
    if (status.trim()) throw new Error("Vault Git memiliki perubahan belum commit. Commit/stash dahulu atau gunakan --force.");
  }
  const entries: Array<{ id: string; path: string; content: string }> = [];
  const root = join(vaultPath(), MEM_DIR);
  if (existsSync(root)) {
    const stack = [root];
    while (stack.length) {
      const dir = stack.pop()!;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) { stack.push(full); continue; }
        if (!entry.name.endsWith(".md") || entry.name.endsWith(".conflict.md")) continue;
        const content = readFileSync(full, "utf8");
        const id = /^id:\s*(.+)$/m.exec(content)?.[1]?.trim();
        if (id) entries.push({ id, path: full, content });
      }
    }
  }
  const manifest = buildSyncManifest(entries.map((entry) => ({ ...entry, path: relativeVaultPath(entry.path) })));
    writeManifest(manifest);
  return { path: manifestPath(), count: entries.length };
}

const DEFAULT_VAULT = "C:/path/to/your/ObsidianVault";
const MEM_DIR = "memories";
const ARCHIVE_DIR = "memories/_archived";

/** Lokasi vault — bisa ditimpa lewat env OBSIDIAN_VAULT_PATH. */
export function vaultPath(): string {
  const p = (process.env.OBSIDIAN_VAULT_PATH ?? "").trim();
  return (p || DEFAULT_VAULT).replace(/\\/g, "/");
}

export function vaultEnabled(): boolean {
  return existsSync(vaultPath());
}

export function watcherLockPath(vault = vaultPath()): string {
  return join(vault, ".shared-agent-memory-watch.lock");
}

export function acquireWatcherLock(vault = vaultPath()): () => void {
  const lock = watcherLockPath(vault);
  try {
    const fd = openSync(lock, "wx");
    writeFileSync(fd, `${process.pid}\n`, "utf8");
    closeSync(fd);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`Watcher lain sedang berjalan: ${lock}`);
    }
    throw err;
  }
  return () => {
    try { unlinkSync(lock); } catch { /* already removed */ }
  };
}

function slugify(text: string, max = 60): string {
  const s = text
    .toLowerCase()
    .replace(/[^a-z0-9\u00e0-\u024f]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);
  return s || "memory";
}

function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8);
}

function fileName(m: Pick<Memory, "id" | "title">): string {
  return `${shortId(m.id)}-${slugify(m.title)}.md`;
}

function fmValue(v: string): string {
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function toFrontmatter(m: Memory): string {
  const lines = [
    "---",
    `id: ${m.id}`,
    `title: ${fmValue(m.title)}`,
    `agent: ${m.agent}`,
    `category: ${m.category}`,
    `tags: [${m.tags.map((t) => fmValue(t)).join(", ")}]`,
    `importance: ${m.importance}`,
    `status: ${m.status}`,
    `notion_url: ${m.url || "-"}`,
    `created_at: ${m.createdAt}`,
    `updated_at: ${m.updatedAt}`,
    "---",
    "",
  ];
  return lines.join("\n");
}

function categoryDir(category: string): string {
  const safe = /^[a-z-]+$/.test(category) ? category : "other";
  const dir = join(vaultPath(), MEM_DIR, safe);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Cari file memori berdasarkan id Notion (scan frontmatter). */
function findFileById(id: string): string | undefined {
  const root = join(vaultPath(), MEM_DIR);
  if (!existsSync(root)) return undefined;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (full !== join(root, ARCHIVE_DIR)) stack.push(full);
        continue;
      }
      if (!entry.name.endsWith(".md")) continue;
      try {
        const head = readFileSync(full, "utf8").slice(0, 600);
        const fileId = /^id:\s*(.+)$/m.exec(head)?.[1]?.trim();
        if (fileId && fileId.replace(/-/g, "").toLowerCase() === id.replace(/-/g, "").toLowerCase()) return full;
      } catch {
        /* skip unreadable */
      }
    }
  }
  return undefined;
}

/** Tulis/perbarui file memori di vault. No-op jika vault tidak ada. */
export function upsertMemoryFile(m: Memory): string | undefined {
  if (!vaultEnabled()) return undefined;
  const existing = findFileById(m.id);
  const dir = categoryDir(m.category);
  const target = join(dir, fileName(m));
  const body = toFrontmatter(m) + `# ${m.title}\n\n${m.content}\n`;

  if (existing && existing !== target) {
    // pindah kategori / ganti judul: hapus file lama, tulis di lokasi baru
    rmSync(existing);
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(target, body, "utf8");
  return target;
}

/** Arsipkan file memori (pindah ke memories/_archived/). */
/** Sync a memory while preserving files changed since the previous sync. */
export function syncMemoryFile(m: Memory, force = false): { path?: string; conflict?: string } {
  if (!vaultEnabled()) return {};
  const manifest = readManifest();
  const existing = findFileById(m.id);
  const body = toFrontmatter(m) + `# ${m.title}\n\n${m.content}\n`;
  if (existing && !force) {
    const previous = manifest[m.id];
    const current = readFileSync(existing, "utf8");
    if (isConflict(current, previous?.hash, body)) {
      const conflict = `${existing}.conflict.md`;
      if (!existsSync(conflict)) writeFileSync(conflict, body, "utf8");
      return { path: existing, conflict };
    }
  }
  if (existing && existsSync(existing)) {
    const current = readFileSync(existing, "utf8");
    if (current !== body) backupFile(existing);
  }
  const path = upsertMemoryFile(m);
  if (path) {
    manifest[m.id] = { path: relativeVaultPath(path), hash: contentHash(readFileSync(path, "utf8")) };
    writeManifest(manifest);
  }
  return { path };
}

export function archiveMissingMemoryFiles(activeIds: Set<string>): string[] {
  if (!vaultEnabled()) return [];
  const manifest = readManifest();
  const archived: string[] = [];
  const active = new Set([...activeIds].map((id) => id.replace(/-/g, "").toLowerCase()));
  const candidates: string[] = [];
  const root = join(vaultPath(), MEM_DIR);
  if (existsSync(root)) {
    const stack = [root];
    while (stack.length) {
      const dir = stack.pop()!;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (full !== join(root, ARCHIVE_DIR)) stack.push(full);
          continue;
        }
        if (!entry.name.endsWith(".md")) continue;
        const head = readFileSync(full, "utf8").slice(0, 600);
        const fileId = /^id:\s*(.+)$/m.exec(head)?.[1]?.trim();
        if (!fileId || active.has(fileId.replace(/-/g, "").toLowerCase())) continue;
        if (entry.name.endsWith(".conflict.md")) {
          rmSync(full);
        } else {
          candidates.push(full);
        }
      }
    }
  }
  for (const key of Object.keys(manifest)) {
    if (!active.has(key.replace(/-/g, "").toLowerCase())) {
      const existing = findFileById(key);
      if (existing && !candidates.includes(existing)) candidates.push(existing);
      removeManifestEntry(manifest, key);
    }
  }
  if (candidates.length) {
    const archiveDir = join(vaultPath(), ARCHIVE_DIR);
    mkdirSync(archiveDir, { recursive: true });
    for (const existing of candidates) {
      const target = join(archiveDir, existing.split(/[\\/]/).pop()!);
      renameSync(existing, target);
      archived.push(relativeVaultPath(target));
    }
    writeManifest(manifest);
  } else if (Object.keys(manifest).length !== Object.keys(readManifest()).length) {
    writeManifest(manifest);
  }
  return archived;
}

export function archiveMemoryFile(id: string, hard = false): void {
  if (!vaultEnabled()) return;
  const existing = findFileById(id);
  if (!existing) return;
  if (hard) {
    rmSync(existing);
    const manifest = readManifest();
    removeManifestEntry(manifest, id);
    writeManifest(manifest);
    return;
  }
  const archiveDir = join(vaultPath(), ARCHIVE_DIR);
  mkdirSync(archiveDir, { recursive: true });
  renameSync(existing, join(archiveDir, existing.split(/[\\/]/).pop()!));
  const manifest = readManifest();
  removeManifestEntry(manifest, id);
  writeManifest(manifest);
}

function run(cmd: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd, timeout: 60000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${cmd} ${args.join(" ")}: ${stderr || err.message}`));
      else resolve(stdout);
    });
  });
}

/**
 * Auto-commit (+ push) perubahan vault. Fire-and-forget — kegagalan
 * (repo belum init, offline, dsb.) tidak boleh mengganggu operasi memori.
 */
export async function gitAutoSync(message: string): Promise<void> {
  if (!vaultEnabled()) return;
  const cwd = vaultPath();
  if (!existsSync(join(cwd, ".git"))) return;
  try {
    await run("git", ["add", "-A"], cwd);
    const status = await run("git", ["status", "--porcelain"], cwd);
    if (!status.trim()) return;
    await run("git", ["commit", "-m", message, "--quiet"], cwd);
    // push best-effort; jika offline commit tetap aman, sync berikutnya menyusul
    try {
      await run("git", ["push", "--quiet"], cwd);
    } catch {
      /* offline / belum ada remote — abaikan */
    }
  } catch {
    /* jangan pernah menggagalkan penyimpanan memori gara-gara git */
  }
}

/** Tarik perubahan dari remote (dipakai manual sebelum membaca vault dari mesin lain). */
export async function gitPull(): Promise<string> {
  return run("git", ["pull", "--rebase"], vaultPath());
}

/** Dorong semua commit lokal ke remote. */
export async function gitPush(): Promise<string> {
  return run("git", ["push"], vaultPath());
}
