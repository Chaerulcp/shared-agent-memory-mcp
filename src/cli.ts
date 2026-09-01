#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig, normalizeId } from "./config.js";
import { acquireWatcherLock } from "./obsidian.js";
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
  init <parent-page-url> [--title "Agent Memory"]
       Membuat database memori di Notion dan menyimpan ID-nya ke .env
  doctor
       Periksa konfigurasi dan koneksi ke Notion
  search <query> [--agent X] [--category X] [--tag X] [--limit N] [--all] [--json]
       Cari memori
  recent [--limit N] [--agent X] [--json]
       Memori terbaru
  add --title "..." --content "..." [--content-file f] [--agent X]
      [--category X] [--tags a,b] [--importance high|medium|low]
       Simpan memori baru
  get <id> [--json]
       Lihat satu memori
  update <id> [--title] [--content] [--agent] [--category] [--tags]
              [--importance] [--status active|archived]
       Perbarui memori
  delete <id> [--hard]
       Arsipkan memori (default) atau buang ke trash Notion (--hard)
  export [--out file.json]
       Ekspor semua memori ke JSON
  sync [--dry-run]
       Tinjau/sinkronkan perubahan Notion ke Obsidian
       (dry-run hanya membaca Notion, tanpa menulis file atau Git)
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

function printMemory(m: Memory, opts: { full?: boolean } = {}) {
  console.log(`• ${m.title}`);
  console.log(`  id       : ${m.id}`);
  console.log(
    `  agent    : ${m.agent} | kategori: ${m.category} | importance: ${m.importance} | status: ${m.status}`
  );
  if (m.tags.length) console.log(`  tags     : ${m.tags.join(", ")}`);
  console.log(`  updated  : ${m.updatedAt}`);
  if (opts.full) console.log(`  isi      :\n${m.content}`);
  else console.log(`  isi      : ${short(m.content, 160)}`);
  console.log(`  url      : ${m.url}`);
  console.log();
}

function parseTags(raw: string | undefined): string[] | undefined {
  if (raw === undefined) return undefined;
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
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

  const output = (results: Memory[]) => {
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

    case "doctor": {
      const cfg = loadConfig();
      console.log("== Agent Memory Notion — doctor ==");
      console.log(
        `NOTION_TOKEN       : ${cfg.notionToken ? `OK (${cfg.notionToken.slice(0, 12)}...)` : "KOSONG — isi di .env"}`
      );
      console.log(
        `NOTION_DATABASE_ID : ${cfg.databaseId ? `OK (${cfg.databaseId})` : "KOSONG — jalankan: npm run init-db -- <parent-page-url>"}`
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
      console.log("Selesai. Verifikasi dengan: npm run doctor");
      break;
    }

    case "search": {
      const query = positional.slice(1).join(" ") || str("query") || "";
      if (!query) throw new Error('Query wajib diisi: node dist/cli.js search "kata kunci"');
      const results = await searchMemories({
        query,
        agent: enumCheck(str("agent"), AGENTS, "agent"),
        category: enumCheck(str("category"), CATEGORIES, "category"),
        tag: str("tag"),
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
      const mem = await addMemory({
        title,
        content,
        agent: enumCheck(str("agent"), AGENTS, "agent") ?? "shared",
        category: enumCheck(str("category"), CATEGORIES, "category") ?? "other",
        tags: parseTags(str("tags")),
        importance: enumCheck(str("importance"), IMPORTANCE, "importance") ?? "medium",
      });
      console.log("Memori tersimpan.\n");
      printMemory(mem, { full: true });
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
      const mem = await updateMemory(id, {
        title: str("title"),
        content: str("content"),
        agent: enumCheck(str("agent"), AGENTS, "agent"),
        category: enumCheck(str("category"), CATEGORIES, "category"),
        tags: parseTags(str("tags")),
        importance: enumCheck(str("importance"), IMPORTANCE, "importance"),
        status: enumCheck(str("status"), STATUSES, "status"),
      });
      console.log("Memori diperbarui.\n");
      printMemory(mem, { full: true });
      break;
    }

    case "delete": {
      const id = positional[1];
      if (!id) throw new Error("ID wajib diisi: node dist/cli.js delete <id>");
      await deleteMemory(id, bool("hard"));
      console.log(
        bool("hard") ? "Memori dibuang ke trash Notion." : "Memori diarsipkan (status = archived)."
      );
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
      const dryRun = bool("dry-run");
      const result = await syncNotionToObsidian(dryRun);
      console.log(dryRun
        ? `${result.count} memori akan disinkronkan (dry-run; tidak ada file/Git yang diubah).`
        : `${result.count} memori disinkronkan dari Notion ke Obsidian.`);
      break;
    }

    case "watch": {
      const releaseLock = acquireWatcherLock();
      process.once("SIGINT", releaseLock);
      process.once("SIGTERM", releaseLock);
      const interval = Math.max(30, parseInt(str("interval") ?? "300", 10) || 300);
      console.log(`Memantau Notion setiap ${interval} detik. Tekan Ctrl+C untuk berhenti.`);
      const runSync = async () => {
        try {
          const result = await syncNotionToObsidian();
          console.log(`[${new Date().toISOString()}] Sinkronisasi selesai: ${result.count} file.`);
        } catch (err) {
          console.error(`[${new Date().toISOString()}] Sinkronisasi gagal: ${errMsg(err)}`);
        }
      };
      await runSync();
      setInterval(() => void runSync(), interval * 1000);
      await new Promise<void>(() => undefined);
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

