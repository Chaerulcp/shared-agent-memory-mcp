import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { env } from "@huggingface/transformers";
import Database from "better-sqlite3";
import { load as loadSqliteVec } from "sqlite-vec";
import { z } from "zod";
import { cacheInput, createMemoryCache } from "../dist/cache.js";
import { embedTexts, searchSemanticCache } from "../dist/semantic-search.js";

const fixtureSchema = z.object({
  description: z.string(),
  memories: z.array(z.object({ id: z.string(), title: z.string(), content: z.string() })).min(1),
  queries: z.array(z.object({ id: z.string(), text: z.string(), relevantIds: z.array(z.string()).min(1) })).min(1),
});
const fixtureBytes = readFileSync(new URL("./retrieval-fixture.json", import.meta.url));
const fixture = fixtureSchema.parse(JSON.parse(fixtureBytes.toString("utf8")));
const fixtureHash = createHash("sha256").update(fixtureBytes).digest("hex");
const fillerTopics = [
  ["Warehouse pallet ledger", "Record the count of sealed pallets in the loading bay."],
  ["Botanical seed catalog", "Track greenhouse seed packets by season and shelf."],
  ["Astronomy observation log", "Record telescope exposure and sky conditions."],
  ["Kitchen supply checklist", "Count pantry containers and weekly ingredients."],
];

function parseArgs(args) {
  const flags = new Map();
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i];
    const value = args[i + 1];
    if (!name?.startsWith("--") || value === undefined) throw new Error("Expected --sizes, --modes, or --repeats with a value");
    flags.set(name, value);
  }
  const sizes = z.array(z.number().int().min(fixture.memories.length).max(10000)).min(1).parse(
    (flags.get("--sizes") ?? "100").split(",").map(Number),
  );
  const modes = z.array(z.enum(["keyword", "semantic", "hybrid", "semantic-sql", "semantic-vec"])).min(1).parse(
    (flags.get("--modes") ?? "keyword,semantic,hybrid").split(","),
  );
  const repeats = z.number().int().min(1).max(20).parse(Number(flags.get("--repeats") ?? "3"));
  for (const name of flags.keys()) {
    if (!["--sizes", "--modes", "--repeats"].includes(name)) throw new Error(`Unknown option: ${name}`);
  }
  return { sizes, modes, repeats };
}

function corpus(size) {
  const now = "2026-01-01T00:00:00Z";
  const records = fixture.memories.map((item) => ({
    ...item, agent: "shared", category: "context", tags: [], importance: "medium",
    status: "active", url: "", project: "benchmark", createdAt: now, updatedAt: now,
  }));
  for (let i = records.length; i < size; i++) {
    const topic = fillerTopics[i % fillerTopics.length];
    records.push({
      id: `filler-${i}`, title: `${topic[0]} ${i}`, content: `${topic[1]} Batch ${i}.`,
      agent: "shared", category: "context", tags: [], importance: "medium",
      status: "active", url: "", project: "benchmark", createdAt: now, updatedAt: now,
    });
  }
  return records;
}

function percentile(samples, fraction) {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * fraction) - 1];
}

function metrics(rankings) {
  let recall = 0;
  let reciprocalRank = 0;
  const queryResults = fixture.queries.map((query) => {
    const ids = rankings.get(query.id) ?? [];
    const relevant = new Set(query.relevantIds);
    const found = ids.slice(0, 5).filter((id) => relevant.has(id)).length;
    recall += found / relevant.size;
    const rank = ids.slice(0, 10).findIndex((id) => relevant.has(id));
    if (rank >= 0) reciprocalRank += 1 / (rank + 1);
    return { id: query.id, firstRelevantRank: rank >= 0 ? rank + 1 : null };
  });
  return {
    recallAt5: Number((recall / fixture.queries.length).toFixed(4)),
    mrrAt10: Number((reciprocalRank / fixture.queries.length).toFixed(4)),
    queryResults,
  };
}

function directoryBytes(path) {
  if (!existsSync(path)) return 0;
  return readdirSync(path, { withFileTypes: true }).reduce((total, entry) => {
    const entryPath = join(path, entry.name);
    return total + (entry.isDirectory() ? directoryBytes(entryPath) : statSync(entryPath).size);
  }, 0);
}

function sqliteBytes(path) {
  return [path, `${path}-wal`, `${path}-shm`]
    .filter(existsSync)
    .reduce((total, file) => total + statSync(file).size, 0);
}

function buildVectorTable(path) {
  const db = new Database(path);
  try {
    loadSqliteVec(db);
    db.exec("CREATE VIRTUAL TABLE benchmark_vectors USING vec0(embedding float[384] distance_metric=cosine)");
    db.exec("CREATE TABLE benchmark_vector_ids (rowid INTEGER PRIMARY KEY, memory_id TEXT NOT NULL)");
    const vectors = db.prepare("SELECT memory_id, vector FROM semantic_embeddings").all();
    const insertVector = db.prepare("INSERT INTO benchmark_vectors(embedding) VALUES (?)");
    const insertId = db.prepare("INSERT INTO benchmark_vector_ids(rowid, memory_id) VALUES (?, ?)");
    db.transaction(() => {
      for (const row of vectors) {
        const result = insertVector.run(row.vector);
        insertId.run(result.lastInsertRowid, row.memory_id);
      }
    })();
    return { count: vectors.length, bytes: sqliteBytes(path) };
  } finally {
    db.close();
  }
}

async function searchVectorTable(path, text) {
  const queryVector = (await embedTexts([text]))[0];
  const db = new Database(path, { readonly: true });
  try {
    loadSqliteVec(db);
    const rows = db.prepare(`
      SELECT ids.memory_id AS id, vectors.distance AS distance
      FROM benchmark_vectors AS vectors
      JOIN benchmark_vector_ids AS ids ON ids.rowid = vectors.rowid
      WHERE vectors.embedding MATCH ? AND k = 10
      ORDER BY vectors.distance
    `).all(Buffer.from(queryVector.buffer, queryVector.byteOffset, queryVector.byteLength));
    return rows.filter((row) => row.distance <= 0.8).map((row) => row.id);
  } finally {
    db.close();
  }
}

async function searchVectorSql(path, text) {
  const queryVector = (await embedTexts([text]))[0];
  const db = new Database(path, { readonly: true });
  try {
    loadSqliteVec(db);
    const rows = db.prepare(`
      SELECT e.memory_id AS id, vec_distance_cosine(e.vector, ?) AS distance
      FROM semantic_embeddings AS e
      JOIN memory_cache AS c ON c.id = e.memory_id
      WHERE c.project = 'benchmark'
      ORDER BY distance LIMIT 10
    `).all(Buffer.from(queryVector.buffer, queryVector.byteOffset, queryVector.byteLength));
    return rows.filter((row) => row.distance <= 0.8).map((row) => row.id);
  } finally {
    db.close();
  }
}

async function runMode(mode, path, repeats) {
  const search = mode === "keyword"
    ? async (text) => {
        const cache = createMemoryCache(path);
        try { return cache.search(text, "benchmark", 10).map((row) => row.id); }
        finally { cache.close(); }
      }
    : mode === "semantic-sql"
    ? async (text) => searchVectorSql(path, text)
    : mode === "semantic-vec"
    ? async (text) => searchVectorTable(path, text)
    : async (text) => (await searchSemanticCache({ query: text, mode, project: "benchmark", limit: 10 }, path))
        .map((memory) => memory.id);
  const warmupStart = performance.now();
  await search(fixture.queries[0].text);
  const warmupMs = performance.now() - warmupStart;
  const rankings = new Map();
  const durations = [];
  for (let repeat = 0; repeat < repeats; repeat++) {
    for (const query of fixture.queries) {
      const start = performance.now();
      const ids = await search(query.text);
      durations.push(performance.now() - start);
      if (repeat === 0) rankings.set(query.id, ids);
    }
  }
  const scored = metrics(rankings);
  return {
    mode, queries: fixture.queries.length, samples: durations.length,
    ...scored,
    p50Ms: Number(percentile(durations, 0.5).toFixed(3)),
    p95Ms: Number(percentile(durations, 0.95).toFixed(3)),
    warmupMs: Number(warmupMs.toFixed(3)),
    sqliteBytes: sqliteBytes(path),
  };
}

async function main() {
  const { sizes, modes, repeats } = parseArgs(process.argv.slice(2));
  env.allowRemoteModels = false;
  const root = mkdtempSync(join(tmpdir(), "agent-memory-retrieval-bench-"));
  const results = [];
  try {
    for (const size of sizes) {
      const path = join(root, `memory-${size}.sqlite`);
      const records = corpus(size);
      const indexStart = performance.now();
      const cache = createMemoryCache(path);
      try { cache.replaceAll(records.map(cacheInput)); }
      finally { cache.close(); }
      const indexMs = Number((performance.now() - indexStart).toFixed(3));
      let vectorIndex;
      for (const mode of modes) {
        if (mode === "semantic-sql" || mode === "semantic-vec") {
          await searchSemanticCache({ query: fixture.queries[0].text, mode: "semantic", project: "benchmark", limit: 10 }, path);
          if (mode === "semantic-vec") {
            vectorIndex = buildVectorTable(path);
            if (vectorIndex.count !== size) throw new Error(`Expected ${size} vectors, found ${vectorIndex.count}`);
          }
        }
        const result = await runMode(mode, path, repeats);
        results.push({ size, indexMs, ...(mode === "semantic-vec" ? { vectorIndex } : {}), ...result });
      }
    }
    const modelPath = join(env.cacheDir, "Xenova", "paraphrase-multilingual-MiniLM-L12-v2");
    const report = {
      fixture: { sha256: fixtureHash, memories: fixture.memories.length, queries: fixture.queries.length, filler: "four deterministic unrelated topics" },
      environment: { node: process.version, platform: process.platform, arch: process.arch, cpu: cpus()[0]?.model ?? "unknown", cores: cpus().length },
      method: { repeats, cache: "fresh SQLite snapshot", latency: "warm query, one process and cache path", index: "SQLite FTS5 snapshot; semantic-vec builds separate persistent vec0 table after embedding warmup", semantic: "local q8 MiniLM; first query builds missing vectors; remote downloads disabled" },
      modelBytes: directoryBytes(modelPath),
      results,
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    const rel = relative(resolve(tmpdir()), resolve(root));
    if (rel && !rel.startsWith("..") && !isAbsolute(rel)) rmSync(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
