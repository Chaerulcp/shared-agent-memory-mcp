#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { loadConfig, loadDotEnv, normalizeId } from "./config.js";
import { acquireWatcherLock, initSyncBaseline, listConflictFiles, resolveConflict, type GitSyncResult } from "./obsidian.js";
import { runSetup } from "./setup.js";
import { cacheInput, cachePath, createMemoryCache } from "./cache.js";
import { resolveProject } from "./project-context.js";
import { formatDoctorSummary, runDoctorSync } from "./doctor.js";
import { runWatchLoop } from "./watch.js";
import type { SemanticSearchResult } from "./semantic-search.js";
import {
  AGENTS,
  CATEGORIES,
  IMPORTANCE,
  STATUSES,
  addMemory,
  checkAuth,
  checkDatabase,
  createMemoryDatabase,
  deleteMemory,
  getMemory,
  listAll,
  searchMemories,
  syncNotionToObsidian,
  updateMemory,
  type Memory,
} from "./store.js";

const HELP = `Agent Memory Notion — CLI

Pemakaian: node dist/cli.js <perintah> [argumen] [--flags]

Perintah:
  setup [--dry-run]
       Periksa project, .env, Notion, Obsidian, dan Git
  init <parent-page-url> [--title "Agent Memory"]
       Membuat database di Notion dan menyimpan ID-nya ke .env
  doctor [--sync]
       Periksa konfigurasi dan koneksi ke Notion; --sync menjalankan health check lengkap
  cache rebuild
       Tarik semua memori Notion dan bangun ulang cache SQLite FTS5
  cache search <query> [--limit N] [--json]
       Cari cache lokal (jalankan cache rebuild terlebih dahulu)
  cache clear
       Hapus seluruh cache lokal
  search <query> [--mode keyword|semantic|hybrid] [--project X | --current-project] [--agent X] [--category X] [--tag X] [--limit N] [--all] [--json]
       Cari memori dengan scope project opsional.
       Mode semantic/hybrid memerlukan cache segar; unduhan model lokal terjadi pada pencarian pertama.
  recent [--limit N] [--agent X] [--json]
       Memori terbaru
  add --title "..." --content "..." [--content-file f] [--agent X] [--idempotency-key X]
      [--category X] [--tags a,b] [--importance high|medium|low] [--project X]
       Simpan memori baru (project otomatis dari Git bila tidak diset)
       Pakai key yang sama bila mengulang satu operasi add setelah respons terputus
  get <id> [--json]
       Lihat satu memori
  update <id> [--title] [--content] [--agent] [--category] [--tags]
              [--importance] [--status active|archived]
       Perbarui memori
  delete <id> [--hard]
       Arsipkan memori (default) atau buang ke trash Notion (--hard)
  export [--out file.json]
       Ekspor semua memori ke JSON
  sync [--dry-run] [--force] [--init-baseline]
       Tinjau/sinkronkan perubahan Notion ke Obsidian
       --init-baseline membuat manifest dari file existing tanpa Notion
       Konflik dipertahankan; --force menimpa file yang berubah manual
       (dry-run hanya membaca Notion, tanpa menulis file atau Git)
  conflicts [--json]
       Daftar conflict copy Obsidian yang belum diselesaikan
  resolve <memories/...md.conflict.md> --accept-notion | --keep-obsidian
       Selesaikan satu conflict; accept-notion membuat backup file asli
  watch [--interval N]
       Pantau Notion berkala (interval dalam detik; default 300)

Catatan: sync/watch memerlukan OBSIDIAN_VAULT_PATH dan vault Git.
Perubahan langsung di Notion tidak dapat memicu MCP yang sedang idle;
watch harus dijalankan sebagai proses latar belakang.

Agent    : ${AGENTS.join(", ")}
Kategori : ${CATEGORIES.join(", ")}
`;

interface Parsed {
  positional: string[];
  flags: Map<string, string | boolean>;
}

function parseArgs(argv: string[]): Parsed {
  const positional: string[] = [];
  const flags = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags.set(key, next);
        i++;
      } else {
        flags.set(key, true);
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function enumCheck(
  value: string | undefined,
  allowed: readonly string[],
  label: string
): string | undefined {
  if (value === undefined) return undefined;
  if (!allowed.includes(value)) {
    throw new Error(`${label} tidak valid: "${value}". Pilihan: ${allowed.join(", ")}`);
  }
  return value;
}

function short(text: string, max: number): string {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > max ? one.slice(0, max - 1) + "…" : one;
}

function printMemory(m: SemanticSearchResult, opts: { full?: boolean } = {}) {
  console.log(`• ${m.title}`);
  console.log(`  id       : ${m.id}`);
  console.log(
    `  agent    : ${m.agent} | kategori: ${m.category} | importance: ${m.importance} | status: ${m.status}`
  );
  if (m.tags.length) console.log(`  tags     : ${m.tags.join(", ")}`);
  if (m.project) console.log(`  project  : ${m.project}`);
  if (m.freshness) console.log(`  freshness: ${m.freshness}`);
  console.log(`  updated  : ${m.updatedAt}`);
  if (opts.full) console.log(`  isi      :\n${m.content}`);
  else if (m.match) {
    console.log(`  cocok    : karakter ${m.match.start}–${m.match.end}`);
    console.log(`  isi      : ${m.match.excerpt.replace(/\s+/g, " ").trim()}`);
  } else console.log(`  isi      : ${short(m.content, 160)}`);
  console.log(`  url      : ${m.url}`);
  console.log();
}

function reportGitSync(git: GitSyncResult | undefined): void {
  if (!git) return;
  if (git.status === "not-a-repo") console.error("Git vault belum diinisialisasi; perubahan Obsidian belum di-commit.");
  if (git.status === "pending-push" || git.status === "failed") console.error(`Git: ${git.message}`);
  if (git.status === "failed") process.exitCode = 2;
}

function reportMirrorError(error: string | undefined): void {
  if (error) console.error(`Notion tersimpan, tetapi mirror Obsidian gagal: ${error}`);
}

function reportCacheError(error: string | undefined): void {
  if (error) console.error(`Notion tersimpan, tetapi cache lokal gagal dibersihkan: ${error}`);
}

function parseTags(raw: string | undefined): string[] | undefined {
  if (raw === undefined) return undefined;
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

async function rebuildCache(): Promise<number> {
  const memories = await listAll();
  const cache = createMemoryCache();
  try { cache.replaceAll(memories.map(cacheInput)); return memories.length; }
  finally { cache.close(); }
}

function cacheSearch(query: string, limit: number): Memory[] {
  const cache = createMemoryCache();
  try { return cache.search(query, undefined, limit) as Memory[]; }
  finally { cache.close(); }
}

function clearCache(): void {
  const cache = createMemoryCache();
  try { cache.clear(); } finally { cache.close(); }
}

function cacheCount(): number {
  const cache = createMemoryCache();
  try { return cache.count(); } finally { cache.close(); }
}

function upsertEnvVar(key: string, value: string) {
  const file = join(process.cwd(), ".env");
  let content = existsSync(file) ? readFileSync(file, "utf8") : "";
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(content)) {
    content = content.replace(re, `${key}=${value}`);
  } else {
    content += (content && !content.endsWith("\n") ? "\n" : "") + `${key}=${value}\n`;
  }
  writeFileSync(file, content);
  console.log(`.env diperbarui: ${key}`);
}

async function main() {
  loadDotEnv();
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const cmd = positional[0] ?? "help";
  const str = (k: string): string | undefined => {
    const v = flags.get(k);
    return typeof v === "string" ? v : undefined;
  };
  const bool = (k: string): boolean => flags.get(k) === true;
  const limitFlag = (): number | undefined => {
    const l = str("limit");
    if (!l) return undefined;
    const n = parseInt(l, 10);
    return Number.isFinite(n) && n > 0 ? n : 10;
  };
  const json = bool("json");

  const output = (results: SemanticSearchResult[]) => {
    if (json) {
      console.log(JSON.stringify(results, null, 2));
      return;
    }
    if (results.length === 0) {
      console.log("Tidak ada memori yang cocok.");
      return;
    }
    for (const m of results) printMemory(m);
  };

  switch (cmd) {
    case "help":
    case "--help":
    case "-h": {
      console.log(HELP);
      break;
    }

    case "setup": {
      process.exitCode = await runSetup({ dryRun: bool("dry-run") });
      break;
    }

    case "doctor": {
      if (bool("sync")) {
        const summary = await runDoctorSync();
        console.log(formatDoctorSummary(summary));
        if (!summary.healthy) process.exitCode = 1;
        break;
      }
      const cfg = loadConfig();
      console.log("== Agent Memory Notion — doctor ==");
      console.log(
        `NOTION_TOKEN       : ${cfg.notionToken ? "OK" : "KOSONG — isi di .env"}`
      );
      console.log(
        `NOTION_DATABASE_ID : ${cfg.databaseId ? `OK (${cfg.databaseId})` : "KOSONG — jalankan: npm run init-db -- <parent-page-url>"}`
      );
      console.log(
        `NOTION_DATA_SOURCE_ID: ${cfg.dataSourceId ? `OK (${cfg.dataSourceId})` : "OTOMATIS — valid jika database hanya memiliki satu data source"}`
      );
      if (!cfg.notionToken) {
        process.exitCode = 1;
        break;
      }
      try {
        const who = await checkAuth();
        console.log(`Auth Notion        : OK (${who})`);
      } catch (err) {
        console.log(`Auth Notion        : GAGAL — ${errMsg(err)}`);
        process.exitCode = 1;
        break;
      }
      if (cfg.databaseId) {
        const db = await checkDatabase();
        console.log(`Database           : ${db.ok ? "OK" : "GAGAL"} — ${db.message}`);
        if (!db.ok) process.exitCode = 1;
      }
      break;
    }

    case "cache": {
      const action = positional[1] ?? "status";
      if (action === "rebuild") {
        const count = await rebuildCache();
        console.log(`${count} memori diindeks ke cache FTS5: ${cachePath()}`);
      } else if (action === "search") {
        const query = positional.slice(2).join(" ") || str("query") || "";
        if (!query) throw new Error('Query cache wajib diisi: node dist/cli.js cache search "kata kunci"');
        const results = cacheSearch(query, limitFlag() ?? 25);
        output(results);
      } else if (action === "clear") {
        clearCache();
        console.log(`Cache FTS5 dihapus: ${cachePath()}`);
      } else if (action === "status") {
        console.log(`Cache FTS5: ${cacheCount()} memori (${cachePath()})`);
      } else {
        throw new Error("Aksi cache tidak valid. Pilihan: rebuild, search, clear, status");
      }
      break;
    }

    case "init": {
      const target = positional[1];
      if (!target) {
        throw new Error("Parent page wajib diisi: node dist/cli.js init <url-atau-id-page-induk>");
      }
      const title = str("title") ?? "Agent Memory";
      console.log("Membuat database di Notion...");
      const db = await createMemoryDatabase(target, title);
      console.log(`Database berhasil dibuat:\n  URL: ${db.url}\n  ID : ${db.id}\n`);
      upsertEnvVar("NOTION_DATABASE_ID", db.id);
      upsertEnvVar("NOTION_DATA_SOURCE_ID", db.dataSourceId);
      console.log("Selesai. Verifikasi dengan: npm run doctor");
      break;
    }

    case "search": {
      const query = positional.slice(1).join(" ") || str("query") || "";
      if (!query) throw new Error('Query wajib diisi: node dist/cli.js search "kata kunci"');
      const results = await searchMemories({
        query,
        mode: z.enum(["keyword", "semantic", "hybrid"]).optional().parse(str("mode")),
        agent: enumCheck(str("agent"), AGENTS, "agent"),
        category: enumCheck(str("category"), CATEGORIES, "category"),
        tag: str("tag"),
        project: str("project"),
        currentProject: bool("current-project"),
        status: bool("all") ? "all" : undefined,
        limit: limitFlag() ?? 10,
      });
      output(results);
      break;
    }

    case "recent": {
      const results = await searchMemories({
        agent: enumCheck(str("agent"), AGENTS, "agent"),
        limit: limitFlag() ?? 5,
      });
      output(results);
      break;
    }

    case "add": {
      const title = str("title");
      const contentFile = str("content-file");
      const content = str("content") ?? (contentFile ? readFileSync(contentFile, "utf8") : undefined);
      if (!title || !content) {
        throw new Error("--title dan --content (atau --content-file) wajib diisi.");
      }
      const { memory, replayed, conflict, mirrorError, cacheError, git } = await addMemory({
        title,
        content,
        agent: enumCheck(str("agent"), AGENTS, "agent") ?? "shared",
        category: enumCheck(str("category"), CATEGORIES, "category") ?? "other",
        tags: parseTags(str("tags")),
        importance: enumCheck(str("importance"), IMPORTANCE, "importance") ?? "medium",
        project: resolveProject(str("project")),
        idempotencyKey: str("idempotency-key"),
      });
      console.log(replayed ? "Memori yang sudah tersimpan ditemukan kembali.\n" : "Memori tersimpan.\n");
      printMemory(memory, { full: true });
      if (conflict) console.error(`Konflik Obsidian: ${conflict}`);
      reportMirrorError(mirrorError);
      reportCacheError(cacheError);
      reportGitSync(git);
      break;
    }

    case "get": {
      const id = positional[1];
      if (!id) throw new Error("ID wajib diisi: node dist/cli.js get <id>");
      const mem = await getMemory(id);
      if (json) console.log(JSON.stringify(mem, null, 2));
      else printMemory(mem, { full: true });
      break;
    }

    case "update": {
      const id = positional[1];
      if (!id) throw new Error("ID wajib diisi: node dist/cli.js update <id> --title/--content/...");
      const { memory, conflict, mirrorError, cacheError, git } = await updateMemory(id, {
        title: str("title"),
        content: str("content"),
        agent: enumCheck(str("agent"), AGENTS, "agent"),
        category: enumCheck(str("category"), CATEGORIES, "category"),
        tags: parseTags(str("tags")),
        importance: enumCheck(str("importance"), IMPORTANCE, "importance"),
        status: enumCheck(str("status"), STATUSES, "status"),
      });
      console.log("Memori diperbarui.\n");
      printMemory(memory, { full: true });
      if (conflict) console.error(`Konflik Obsidian: ${conflict}`);
      reportMirrorError(mirrorError);
      reportCacheError(cacheError);
      reportGitSync(git);
      break;
    }

    case "delete": {
      const id = positional[1];
      if (!id) throw new Error("ID wajib diisi: node dist/cli.js delete <id>");
      const { mirrorError, cacheError, git } = await deleteMemory(id, bool("hard"));
      console.log(
        bool("hard") ? "Memori dibuang ke trash Notion." : "Memori diarsipkan (status = archived)."
      );
      reportMirrorError(mirrorError);
      reportCacheError(cacheError);
      reportGitSync(git);
      break;
    }

    case "export": {
      const all = await listAll();
      const out = JSON.stringify(all, null, 2);
      const file = str("out");
      if (file) {
        writeFileSync(file, out);
        console.log(`${all.length} memori diekspor ke ${file}`);
      } else {
        console.log(out);
      }
      break;
    }

    case "sync": {
      if (bool("init-baseline")) {
        if (bool("dry-run")) throw new Error("--init-baseline tidak dapat digabungkan dengan --dry-run.");
        const baseline = initSyncBaseline(bool("force"));
        console.log(`Baseline manifest dibuat untuk ${baseline.count} file: ${baseline.path}`);
        break;
      }
      const dryRun = bool("dry-run");
      const force = bool("force");
      const result = await syncNotionToObsidian(dryRun, force);
      console.log(dryRun
        ? `${result.count} memori akan disinkronkan (dry-run; tidak ada file/Git/cache yang diubah).`
        : `${result.count} file disinkronkan dari Notion ke Obsidian.`);
      if (result.conflicts.length) {
        console.error(`${result.conflicts.length} konflik terdeteksi; file manual dipertahankan:`);
        for (const file of result.conflicts) console.error(`  ${file}`);
        process.exitCode = 2;
      }
      reportGitSync(result.git);
      break;
    }

    case "conflicts": {
      const results = listConflictFiles();
      if (json) console.log(JSON.stringify(results, null, 2));
      else if (!results.length) console.log("Tidak ada conflict Obsidian.");
      else results.forEach((file) => console.log(file));
      break;
    }

    case "resolve": {
      const file = positional[1];
      if (!file) throw new Error("Path conflict wajib diisi.");
      const accept = bool("accept-notion");
      const keep = bool("keep-obsidian");
      if (accept === keep) throw new Error("Pilih tepat satu: --accept-notion atau --keep-obsidian.");
      const result = resolveConflict(file, accept ? "accept-notion" : "keep-obsidian");
      console.log(accept ? `Versi Notion diterapkan. Backup: ${result.backup}` : "Versi Obsidian dipertahankan.");
      break;
    }

    case "watch": {
      const releaseLock = acquireWatcherLock();
      const controller = new AbortController();
      const stop = () => controller.abort();
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
      try {
        const interval = Math.max(30, parseInt(str("interval") ?? "300", 10) || 300);
        console.log(`Memantau Notion setiap ${interval} detik. Tekan Ctrl+C untuk berhenti.`);
        const runSync = async () => {
          try {
            const result = await syncNotionToObsidian();
            console.log(`[${new Date().toISOString()}] Sinkronisasi selesai: ${result.count} file, ${result.conflicts.length} konflik.`);
            for (const file of result.conflicts) console.error(`[${new Date().toISOString()}] Konflik dipertahankan: ${file}`);
            reportGitSync(result.git);
          } catch (err) {
            console.error(`[${new Date().toISOString()}] Sinkronisasi gagal: ${errMsg(err)}`);
          }
        };
        await runWatchLoop(runSync, async (signal) => {
          try { await delay(interval * 1000, undefined, { signal }); }
          catch (err) { if (!signal.aborted) throw err; }
        }, controller.signal);
      } finally {
        process.off("SIGINT", stop);
        process.off("SIGTERM", stop);
        releaseLock();
      }
      break;
    }

    default: {
      console.error(`Perintah tidak dikenal: ${cmd}\n`);
      console.log(HELP);
      process.exitCode = 1;
    }
  }
}

main().catch((err) => {
  console.error(`ERROR: ${errMsg(err)}`);
  process.exit(1);
});

