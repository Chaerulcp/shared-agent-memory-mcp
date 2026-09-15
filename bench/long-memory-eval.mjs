import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { env } from "@huggingface/transformers";
import { cacheInput, createMemoryCache } from "../dist/cache.js";
import { embedTexts, searchSemanticCache } from "../dist/semantic-search.js";
import { semanticChunks } from "../dist/semantic-chunks.js";

const introduction = "Routine operating notes and periodic status updates for internal review. ".repeat(25);
const facts = [
  { id: "payment", title: "Field memo A", tail: "If the payment gateway rejects an order, roll back the database transaction so no partial order remains." },
  { id: "secrets", title: "Field memo B", tail: "Store production API credentials in a secret manager, never in the repository or application logs." },
  { id: "session", title: "Field memo C", tail: "When a login session expires, exchange its refresh token for a new access token before retrying once." },
];
const queries = [
  { id: "payment", text: "undo database transaction after a failed payment" },
  { id: "secrets", text: "where should production API credentials be stored" },
  { id: "session", text: "bagaimana memperbarui sesi login yang kedaluwarsa" },
];
const now = new Date().toISOString();
const memories = facts.map((fact) => ({
  id: fact.id, title: fact.title, content: introduction + fact.tail,
  project: "long-memory-eval", agent: "shared", category: "context", tags: [],
  importance: "medium", status: "active", url: "", createdAt: now, updatedAt: now,
}));

function cosine(left, right) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let i = 0; i < left.length; i++) {
    dot += left[i] * right[i];
    leftNorm += left[i] * left[i];
    rightNorm += right[i] * right[i];
  }
  return dot / Math.sqrt(leftNorm * rightNorm);
}

async function main() {
  env.allowRemoteModels = false;
  const root = mkdtempSync(join(tmpdir(), "agent-memory-long-eval-"));
  const path = join(root, "memory.sqlite");
  try {
    const cache = createMemoryCache(path);
    try { cache.replaceAll(memories.map(cacheInput)); }
    finally { cache.close(); }
    const prefixVectors = await embedTexts(memories.map((memory) => semanticChunks(memory.title, memory.content)[0]));
    const queryVectors = await embedTexts(queries.map((query) => query.text));
    const results = [];
    for (const [index, query] of queries.entries()) {
      const oldRanking = memories.map((memory, memoryIndex) => ({
        id: memory.id, score: cosine(queryVectors[index], prefixVectors[memoryIndex]),
      })).sort((a, b) => b.score - a.score).map((item) => item.id);
      const options = { query: query.text, project: "long-memory-eval", limit: 3 };
      const semantic = (await searchSemanticCache({ ...options, mode: "semantic" }, path)).map((memory) => memory.id);
      const hybrid = (await searchSemanticCache({ ...options, mode: "hybrid" }, path)).map((memory) => memory.id);
      results.push({ query: query.id, expected: query.id, prefixOnlyTop1: oldRanking[0], semanticTop1: semantic[0] ?? null, hybridTop1: hybrid[0] ?? null });
    }
    const top1 = (key) => results.filter((result) => result[key] === result.expected).length / results.length;
    process.stdout.write(`${JSON.stringify({
      fixture: { memories: memories.length, queries: queries.length, introCharacters: Array.from(introduction).length, notes: memories.map((memory) => ({ id: memory.id, characters: Array.from(memory.content).length, chunks: semanticChunks(memory.title, memory.content).length })) },
      environment: { node: process.version, platform: process.platform, model: "Xenova/paraphrase-multilingual-MiniLM-L12-v2:q8" },
      recallAt1: { prefixOnly: top1("prefixOnlyTop1"), semantic: top1("semanticTop1"), hybrid: top1("hybridTop1") },
      results,
    }, null, 2)}\n`);
  } finally {
    const rel = relative(resolve(tmpdir()), resolve(root));
    if (rel && !rel.startsWith("..") && !isAbsolute(rel)) rmSync(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
