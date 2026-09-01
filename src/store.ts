import { Client } from "@notionhq/client";
import { loadConfig, normalizeId } from "./config.js";
import { archiveMemoryFile, gitAutoSync, upsertMemoryFile } from "./obsidian.js";
import { findDuplicateCandidates } from "./memory-quality.js";
import { freshnessState, normalizeProvenance } from "./provenance.js";
import { cacheInput, createMemoryCache } from "./cache.js";

function rebuildLocalCache(memories: Memory[]): void {
  const cache = createMemoryCache();
  try {
    cache.replaceAll(memories.map(cacheInput));
  } finally {
    cache.close();
  }
}

export function syncCacheForMemories(memories: Memory[], dryRun = false, cachePath?: string): number {
  if (dryRun) return 0;
  const cache = cachePath ? createMemoryCache(cachePath) : undefined;
  if (cache) {
    try { cache.replaceAll(memories.map(cacheInput)); }
    finally { cache.close(); }
  } else {
    rebuildLocalCache(memories);
  }
  return memories.length;
}

export function cacheSyncSummary(memories: Memory[], dryRun = false): { cached: number; dryRun: boolean } {
  return { cached: syncCacheForMemories(memories, dryRun), dryRun };
}


function optionalProperty(name: string, value: string | undefined, schema?: Record<string, any>) {
  if (!value || !schema?.[name]) return {};
  const type = schema[name];
  if (type.rich_text) return { [name]: richTextProp(value) };
  if (type.select) return { [name]: selectProp(value) };
  return {};
}

function optionalNumberProperty(name: string, value: number | undefined, schema?: Record<string, any>) {
  if (value === undefined || !schema?.[name]?.number) return {};
  return { [name]: { number: value } };
}

function optionalDateProperty(name: string, value: string | undefined, schema?: Record<string, any>) {
  if (!value || !schema?.[name]?.date) return {};
  return { [name]: { date: { start: value } } };
}

export class DuplicateMemoryError extends Error {
  candidates: Memory[];

  constructor(candidates: Memory[]) {
    super(`Memory serupa ditemukan (${candidates.length}). Gunakan memory_update atau allow_duplicate=true.`);
    this.name = "DuplicateMemoryError";
    this.candidates = candidates;
  }
}

async function databaseProperties(): Promise<Record<string, any>> {
  const db: any = await notion().databases.retrieve({ database_id: databaseId() });
  return db.properties ?? {};
}

function optionalProjectProperty(project?: string, properties?: Record<string, any>) {
  if (!project || !properties?.Project) return {};
  const schema = properties.Project;
  if (schema.rich_text) return { Project: richTextProp(project) };
  if (schema.select) return { Project: selectProp(project) };
  return {};
}

function projectName(prop: any): string {
  return prop?.select?.name ?? plainText(prop?.rich_text);
}

function numberValue(prop: any): number | undefined {
  return typeof prop?.number === "number" ? prop.number : undefined;
}

function dateValue(prop: any): string | undefined {
  return prop?.date?.start;
}

async function findDuplicates(input: AddMemoryInput): Promise<Memory[]> {
  const existing = await searchMemories({ status: "active", limit: 100 });
  return findDuplicateCandidates(input, existing, 0.55) as Memory[];
}

export const AGENTS = [
  "cline",
  "opencode",
  "claude-code",
  "copilot",
  "hermes",
  "antigravity",
  "shared",
] as const;

export const CATEGORIES = [
  "preference",
  "decision",
  "convention",
  "context",
  "bugfix",
  "task",
  "other",
] as const;

export const IMPORTANCE = ["high", "medium", "low"] as const;
export const STATUSES = ["active", "archived"] as const;

export interface Memory {
  id: string;
  title: string;
  content: string;
  agent: string;
  category: string;
  tags: string[];
  importance: string;
  status: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  project?: string;
  source?: string;
  confidence?: string;
  verifiedAt?: string;
  freshnessDays?: number;
  supersedes?: string;
  freshness?: "unknown" | "fresh" | "stale";
}

export interface AddMemoryInput {
  title: string;
  content: string;
  agent: string;
  category?: string;
  tags?: string[];
  importance?: string;
  project?: string;
  source?: string;
  confidence?: string;
  verifiedAt?: string;
  freshnessDays?: number;
  supersedes?: string;
  allowDuplicate?: boolean;
}

export interface UpdateMemoryPatch {
  title?: string;
  content?: string;
  agent?: string;
  category?: string;
  tags?: string[];
  importance?: string;
  status?: string;
  project?: string;
  source?: string;
  confidence?: string;
  verifiedAt?: string;
  freshnessDays?: number;
  supersedes?: string;
}

export interface SearchOptions {
  query?: string;
  agent?: string;
  category?: string;
  tag?: string;
  status?: string; // "active" (default) | "archived" | "all"
  project?: string;
  limit?: number;
}

const CHUNK_SIZE = 1900; // batas aman per rich_text item Notion (max 2000)
const FILTER_QUERY_MAX = 200; // batas panjang nilai filter Notion

let _client: Client | undefined;

function notion(): Client {
  if (!_client) {
    const { notionToken } = loadConfig();
    if (!notionToken) {
      throw new Error(
        "NOTION_TOKEN belum diset. Isi di file .env atau di bagian env pada config MCP agent."
      );
    }
    _client = new Client({ auth: notionToken });
  }
  return _client;
}

function databaseId(): string {
  const { databaseId } = loadConfig();
  if (!databaseId) {
    throw new Error(
      "NOTION_DATABASE_ID belum diset. Jalankan `npm run init-db -- <url-page-induk>` untuk membuat database secara otomatis."
    );
  }
  return databaseId;
}

/* ---------------- helpers ---------------- */

export function chunkText(text: string, size = CHUNK_SIZE): string[] {
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > size) {
    let cut = rest.lastIndexOf("\n", size);
    if (cut < size * 0.4) cut = rest.lastIndexOf(" ", size);
    if (cut < size * 0.4) cut = size;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  chunks.push(rest);
  return chunks;
}

function titleProp(text: string) {
  return { title: chunkText(text).map((t) => ({ text: { content: t } })) };
}

function richTextProp(text: string) {
  return { rich_text: chunkText(text).map((t) => ({ text: { content: t } })) };
}

function selectProp(name?: string) {
  return { select: name ? { name } : null };
}

function multiSelectProp(tags: string[]) {
  return { multi_select: tags.map((name) => ({ name })) };
}

function plainText(items: any[] | undefined): string {
  return (items ?? []).map((i: any) => i.plain_text ?? "").join("");
}

function selectName(prop: any): string {
  return prop?.select?.name ?? "";
}

export function pageToMemory(page: any): Memory {
  const p = page.properties ?? {};
  return {
    id: page.id,
    title: plainText(p["Name"]?.title ?? p["Name"]?.rich_text),
    content: plainText(p["Content"]?.rich_text),
    agent: selectName(p["Agent"]) || "shared",
    category: selectName(p["Category"]) || "other",
    tags: (p["Tags"]?.multi_select ?? []).map((t: any) => t.name),
    importance: selectName(p["Importance"]) || "medium",
    status: selectName(p["Status"]) || "active",
    url: page.url ?? "",
    createdAt: page.created_time ?? "",
    updatedAt: page.last_edited_time ?? "",
    project: projectName(p["Project"]),
    source: selectName(p["Source"]) || plainText(p["Source"]?.rich_text),
    confidence: selectName(p["Confidence"]) || plainText(p["Confidence"]?.rich_text),
    verifiedAt: dateValue(p["Verified At"]),
    freshnessDays: numberValue(p["Freshness Days"]),
    supersedes: plainText(p["Supersedes"]?.rich_text),
    freshness: freshnessState({
      verifiedAt: dateValue(p["Verified At"]),
      freshnessDays: numberValue(p["Freshness Days"]),
    }),
  };
}

/* ---------------- operasi memori ---------------- */

export async function addMemory(input: AddMemoryInput): Promise<Memory> {
  if (!input.allowDuplicate) {
    const duplicates = await findDuplicates(input);
    if (duplicates.length > 0) throw new DuplicateMemoryError(duplicates.slice(0, 5));
  }
  const schema = await databaseProperties();
  const res = await notion().pages.create({
    parent: { database_id: databaseId() },
    properties: {
      Name: titleProp(input.title),
      Content: richTextProp(input.content),
      Agent: selectProp(input.agent),
      Category: selectProp(input.category ?? "other"),
      Tags: multiSelectProp(input.tags ?? []),
      Importance: selectProp(input.importance ?? "medium"),
      Status: selectProp("active"),
      ...optionalProjectProperty(input.project, schema),
      ...optionalProperty("Source", normalizeProvenance(input).source, schema),
      ...optionalProperty("Confidence", normalizeProvenance(input).confidence, schema),
      ...optionalDateProperty("Verified At", input.verifiedAt, schema),
      ...optionalNumberProperty("Freshness Days", input.freshnessDays, schema),
      ...optionalProperty("Supersedes", input.supersedes, schema),
    } as any,
  });
  const memory = pageToMemory(res);
  upsertMemoryFile(memory);
  void gitAutoSync(`memory(${memory.agent}): tambah "${memory.title.slice(0, 60)}"`);
  return memory;
}

export async function searchMemories(opts: SearchOptions = {}): Promise<Memory[]> {
  const and: any[] = [];
  const status = opts.status ?? "active";
  if (status !== "all") {
    and.push({ property: "Status", select: { equals: status } });
  }
  if (opts.agent) and.push({ property: "Agent", select: { equals: opts.agent } });
  if (opts.category) and.push({ property: "Category", select: { equals: opts.category } });
  if (opts.tag) and.push({ property: "Tags", multi_select: { contains: opts.tag } });
  if (opts.project) {
    const schema = await databaseProperties();
    const projectSchema = schema.Project;
    if (!projectSchema) return [];
    if (projectSchema.select) and.push({ property: "Project", select: { equals: opts.project } });
    else if (projectSchema.rich_text) and.push({ property: "Project", rich_text: { contains: opts.project } });
    else return [];
  }

  const q = opts.query?.trim();
  if (q) {
    // Catatan: multi_select "Tags" sengaja tidak ikut filter teks bebas —
    // Notion menuntut nama opsi yang persis ada, jadi query bebas bisa
    // memicu validation_error. Pencarian tag eksplisit lewat opts.tag.
    // Strategi: setiap kata harus muncul di Name ATAU Content (AND antar kata).
    const words = q
      .slice(0, FILTER_QUERY_MAX)
      .split(/\s+/)
      .filter(Boolean);
    for (const w of words) {
      and.push({
        or: [
          { property: "Name", rich_text: { contains: w } },
          { property: "Content", rich_text: { contains: w } },
        ],
      });
    }
  }

  try {
    const res = await notion().databases.query({
      database_id: databaseId(),
      filter: and.length ? { and } : undefined,
      sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
      page_size: Math.min(Math.max(opts.limit ?? 10, 1), 100),
    });
    return (res.results as any[]).map(pageToMemory);
  } catch (err) {
    // Jika tag yang diminta belum pernah ada di database, hasilnya memang kosong.
    const msg = err instanceof Error ? err.message : String(err);
    if (opts.tag && msg.includes("multi_select option")) return [];
    throw err;
  }
}

export async function getMemory(id: string): Promise<Memory> {
  const res = await notion().pages.retrieve({ page_id: normalizeId(id) });
  return pageToMemory(res as any);
}

export async function updateMemory(id: string, patch: UpdateMemoryPatch): Promise<Memory> {
  const properties: Record<string, unknown> = {};
  if (patch.title !== undefined) properties["Name"] = titleProp(patch.title);
  if (patch.content !== undefined) properties["Content"] = richTextProp(patch.content);
  if (patch.agent !== undefined) properties["Agent"] = selectProp(patch.agent);
  if (patch.category !== undefined) properties["Category"] = selectProp(patch.category);
  if (patch.tags !== undefined) properties["Tags"] = multiSelectProp(patch.tags);
  if (patch.importance !== undefined) properties["Importance"] = selectProp(patch.importance);
  if (patch.status !== undefined) properties["Status"] = selectProp(patch.status);
  const schema = (patch.project || patch.source || patch.confidence || patch.verifiedAt || patch.freshnessDays !== undefined || patch.supersedes) ? await databaseProperties() : undefined;
  Object.assign(properties,
    optionalProjectProperty(patch.project, schema),
    optionalProperty("Source", patch.source, schema),
    optionalProperty("Confidence", patch.confidence, schema),
    optionalDateProperty("Verified At", patch.verifiedAt, schema),
    optionalNumberProperty("Freshness Days", patch.freshnessDays, schema),
    optionalProperty("Supersedes", patch.supersedes, schema),
  );

  if (Object.keys(properties).length === 0) {
    throw new Error("Tidak ada field yang diperbarui.");
  }

  const res = await notion().pages.update({
    page_id: normalizeId(id),
    properties: properties as any,
  });
  const memory = pageToMemory(res);
  if (memory.status === "archived") {
    archiveMemoryFile(memory.id);
  } else {
    upsertMemoryFile(memory);
  }
  void gitAutoSync(`memory(${memory.agent}): perbarui "${memory.title.slice(0, 60)}"`);
  return memory;
}

export async function deleteMemory(id: string, hard = false): Promise<void> {
  const page_id = normalizeId(id);
  if (hard) {
    const pages = notion().pages as any;
    if (typeof pages.delete === "function") {
      await pages.delete({ page_id });
    } else {
      await pages.update({ page_id, archived: true });
    }
    archiveMemoryFile(page_id, true);
  } else {
    await notion().pages.update({ page_id, archived: true } as any);
    archiveMemoryFile(page_id, false);
  }
  void gitAutoSync(`memory: hapus/arsipkan ${page_id.slice(0, 8)}`);
}

export async function syncNotionToObsidian(dryRun = false): Promise<{ count: number; synced: string[] }> {
  const memories = await listAll();
  const synced: string[] = [];
  if (dryRun) {
    return { count: memories.length, synced: memories.map((memory) => memory.id) };
  }
  syncCacheForMemories(memories);
  for (const memory of memories) {
    if (memory.status === "archived") {
      archiveMemoryFile(memory.id);
      synced.push(memory.id);
      continue;
    }
    const file = upsertMemoryFile(memory);
    if (file) synced.push(file);
  }
  if (synced.length > 0) {
    await gitAutoSync(`sync: perbarui ${synced.length} memori dari Notion`);
  }
  return { count: synced.length, synced };
}

export async function listAll(): Promise<Memory[]> {
  const out: Memory[] = [];
  let cursor: string | undefined;
  for (;;) {
    const res = await notion().databases.query({
      database_id: databaseId(),
      page_size: 100,
      start_cursor: cursor,
    });
    out.push(...(res.results as any[]).map(pageToMemory));
    if (!res.has_more || !res.next_cursor) break;
    cursor = res.next_cursor;
  }
  return out;
}

/* ---------------- setup & pemeriksaan ---------------- */

export async function createMemoryDatabase(
  parentPage: string,
  title = "Agent Memory"
): Promise<{ id: string; url: string }> {
  const res = await notion().databases.create({
    parent: { type: "page_id", page_id: normalizeId(parentPage) },
    title: [{ text: { content: title } }],
    is_inline: false,
    properties: {
      Name: { title: {} },
      Content: { rich_text: {} },
      Agent: { select: { options: AGENTS.map((name) => ({ name })) } },
      Category: { select: { options: CATEGORIES.map((name) => ({ name })) } },
      Tags: { multi_select: {} },
      Importance: { select: { options: IMPORTANCE.map((name) => ({ name })) } },
      Status: { select: { options: STATUSES.map((name) => ({ name })) } },
      Project: { rich_text: {} },
      Source: { select: { options: ["agent", "user", "notion", "import", "system"].map((name) => ({ name })) } },
      Confidence: { select: { options: ["high", "medium", "low"].map((name) => ({ name })) } },
      "Verified At": { date: {} },
      "Freshness Days": { number: { format: "number" } },
      Supersedes: { rich_text: {} },
      Created: { created_time: {} },
      Updated: { last_edited_time: {} },
    } as any,
  });
  return { id: res.id, url: (res as any).url ?? "" };
}

export async function checkAuth(): Promise<string> {
  const me: any = await notion().users.me({});
  return me?.name ?? me?.type ?? "terhubung";
}

export async function checkDatabase(): Promise<{ ok: boolean; message: string }> {
  try {
    const db: any = await notion().databases.retrieve({ database_id: databaseId() });
    const props = Object.keys(db.properties ?? {});
    const required = ["Name", "Content", "Agent", "Category", "Tags", "Importance", "Status"];
    const missing = required.filter((r) => !props.includes(r));
    if (missing.length > 0) {
      return { ok: false, message: `Properti database hilang: ${missing.join(", ")}` };
    }
    const dbTitle = plainText(db.title);
    return { ok: true, message: `Database "${dbTitle || "tanpa judul"}" dapat diakses` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: `Tidak bisa mengakses database (pastikan page/database di-share ke integrasi): ${message}`,
    };
  }
}

