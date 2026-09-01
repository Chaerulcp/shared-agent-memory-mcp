/**
 * Penyimpanan kedua: vault Obsidian (Markdown lokal + git sync).
 * Setiap memori Notion juga ditulis sebagai file .md di vault agar
 * Obsidian menjadi sumber pengetahuan kedua yang bisa dibaca semua agent.
 */
import { execFile } from "node:child_process";
import {
  closeSync,
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
import { join } from "node:path";
import { contentHash, isConflict, type SyncManifest } from "./obsidian-conflict.js";
import type { Memory } from "./store.js";

const MANIFEST_FILE = ".shared-agent-memory-sync.json";

function manifestPath(): string { return join(vaultPath(), MANIFEST_FILE); }
function readManifest(): SyncManifest {
  try { return JSON.parse(readFileSync(manifestPath(), "utf8")) as SyncManifest; } catch { return {}; }
}
function writeManifest(manifest: SyncManifest): void {
  writeFileSync(manifestPath(), JSON.stringify(manifest, null, 2) + "\n", "utf8");
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
        stack.push(full);
        continue;
      }
      if (!entry.name.endsWith(".md")) continue;
      try {
        const head = readFileSync(full, "utf8").slice(0, 600);
        if (head.includes(`id: ${id}`)) return full;
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
  if (existing && !force) {
    const previous = manifest[m.id];
    const current = readFileSync(existing, "utf8");
    if (isConflict(current, previous?.hash)) {
      const conflict = `${existing}.conflict-${Date.now()}.md`;
      const body = toFrontmatter(m) + `# ${m.title}\n\n${m.content}\n`;
      writeFileSync(conflict, body, "utf8");
      return { path: existing, conflict };
    }
  }
  const path = upsertMemoryFile(m);
  if (path) {
    manifest[m.id] = { path, hash: contentHash(readFileSync(path, "utf8")) };
    writeManifest(manifest);
  }
  return { path };
}

export function archiveMemoryFile(id: string, hard = false): void {
  if (!vaultEnabled()) return;
  const existing = findFileById(id);
  if (!existing) return;
  if (hard) {
    rmSync(existing);
    return;
  }
  const archiveDir = join(vaultPath(), ARCHIVE_DIR);
  mkdirSync(archiveDir, { recursive: true });
  renameSync(existing, join(archiveDir, existing.split(/[\\/]/).pop()!));
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
