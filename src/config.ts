import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseDotEnv(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

let envLoaded = false;

/** Muat .env dari cwd atau root proyek (tanpa menimpa env yang sudah ada). */
export function loadDotEnv(): void {
  if (envLoaded) return;
  envLoaded = true;
  const candidates = [
    resolve(__dirname, "..", ".env"), // root proyek — prioritas utama (server dijalankan dari dist/)
    join(process.cwd(), ".env"), // fallback: cwd pemanggil
  ];
  for (const file of candidates) {
    if (existsSync(file)) {
      const vars = parseDotEnv(readFileSync(file, "utf8"));
      for (const [k, v] of Object.entries(vars)) {
        if (process.env[k] === undefined || process.env[k] === "") {
          process.env[k] = v;
        }
      }
    }
  }
}

export interface AppConfig {
  notionToken: string;
  databaseId: string;
}

export function loadConfig(): AppConfig {
  loadDotEnv();
  return {
    notionToken: (process.env.NOTION_TOKEN ?? "").trim(),
    databaseId: normalizeId(process.env.NOTION_DATABASE_ID ?? ""),
  };
}

/**
 * Ubah URL / ID Notion (boleh pakai strip) menjadi 32 karakter hex bersih.
 * Contoh: https://www.notion.so/space/Judul-Page-0123...abc?v=... -> 0123...abc
 * Contoh baru: https://app.notion.com/p/Agent-Memory-3cd04216...eb -> 3cd04216...eb
 */
export function normalizeId(idOrUrl: string): string {
  const s = idOrUrl.trim();
  if (!s) return "";
  const noDash = s.replace(/-/g, "");
  // Ambil 32-hex terakhir — URL gaya baru menempelkan judul sebelum ID
  const matches = noDash.match(/([0-9a-f]{32})/gi);
  if (matches && matches.length) return matches[matches.length - 1];
  return s;
}
