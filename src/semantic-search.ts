import { createHash } from "node:crypto";
import type { FeatureExtractionPipeline } from "@huggingface/transformers";
import { cachePath, createMemoryCache, memoryFromCache } from "./cache.js";
import type { Memory, SearchOptions } from "./store.js";

const MODEL = "Xenova/paraphrase-multilingual-MiniLM-L12-v2" as const;
const MODEL_KEY = `${MODEL}:q8:mean:v1` as const;
const MAX_TEXT_LENGTH = 1200;
const MIN_SIMILARITY = 0.2;

export type EmbedTexts = (texts: readonly string[]) => Promise<readonly Float32Array[]>;

let extractorPromise: Promise<FeatureExtractionPipeline> | undefined;

export async function embedTexts(texts: readonly string[]): Promise<readonly Float32Array[]> {
  if (texts.length === 0) return [];
  extractorPromise ??= import("@huggingface/transformers").then(({ pipeline }) =>
    pipeline("feature-extraction", MODEL, { dtype: "q8" })
  );
  const extractor = await extractorPromise;
  const output = await extractor([...texts], { pooling: "mean", normalize: true });
  const [count, width] = output.dims;
  if (count !== texts.length || !width) throw new Error("Model embedding returned unexpected dimensions");
  const vectors: Float32Array[] = [];
  for (let i = 0; i < count; i++) {
    const vector = new Float32Array(width);
    for (let j = 0; j < width; j++) vector[j] = Number(output.data[i * width + j]);
    vectors.push(vector);
  }
  return vectors;
}

function semanticText(memory: Memory): string {
  return `${memory.title}\n${memory.content.slice(0, MAX_TEXT_LENGTH)}`;
}

function cosine(left: Float32Array, right: Float32Array): number {
  if (left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let i = 0; i < left.length; i++) {
    dot += left[i] * right[i];
    leftNorm += left[i] * left[i];
    rightNorm += right[i] * right[i];
  }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0;
}

export async function searchSemanticCache(
  options: SearchOptions,
  path = cachePath(),
  embed: EmbedTexts = embedTexts,
): Promise<Memory[]> {
  const query = options.query?.trim();
  if (!query) throw new Error("Semantic search requires a query");
  const cache = createMemoryCache(path);
  try {
    if (!cache.isFresh()) throw new Error("Semantic search requires a fresh cache; run cache rebuild or sync");
    const memories: Memory[] = [];
    for (const row of cache.list(options.project)) {
      const memory = memoryFromCache(row);
      if (!memory) throw new Error("Semantic search requires complete cached memories; run cache rebuild");
      if (options.status !== "all" && memory.status !== (options.status ?? "active")) continue;
      if (options.agent && memory.agent !== options.agent) continue;
      if (options.category && memory.category !== options.category) continue;
      if (options.tag && !memory.tags.includes(options.tag)) continue;
      memories.push(memory);
    }
    if (memories.length === 0) return [];

    const queryVector = (await embed([query]))[0];
    if (!queryVector?.length) throw new Error("Model embedding returned no query vector");
    const vectors = new Map<string, Float32Array>();
    const missing: Array<{ memory: Memory; text: string; hash: string }> = [];
    for (const memory of memories) {
      const text = semanticText(memory);
      const hash = createHash("sha256").update(text).digest("hex");
      const stored = cache.getEmbedding(memory.id, MODEL_KEY, hash);
      if (stored?.length === queryVector.length) vectors.set(memory.id, stored);
      else missing.push({ memory, text, hash });
    }
    for (let offset = 0; offset < missing.length; offset += 16) {
      const batch = missing.slice(offset, offset + 16);
      const embedded = await embed(batch.map((item) => item.text));
      if (embedded.length !== batch.length) throw new Error("Model embedding returned incomplete batch");
      for (let i = 0; i < batch.length; i++) {
        const item = batch[i];
        const vector = embedded[i];
        if (!vector || vector.length !== queryVector.length) throw new Error("Model embedding returned unexpected dimensions");
        cache.setEmbedding(item.memory.id, MODEL_KEY, item.hash, vector);
        vectors.set(item.memory.id, vector);
      }
    }

    const byId = new Map(memories.map((memory) => [memory.id, memory]));
    const semanticIds = memories
      .map((memory) => ({ id: memory.id, score: cosine(queryVector, vectors.get(memory.id) ?? new Float32Array()) }))
      .filter((item) => item.score >= MIN_SIMILARITY)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.id);
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 100);
    if (options.mode !== "hybrid") {
      return semanticIds.slice(0, limit).flatMap((id) => {
        const memory = byId.get(id);
        return memory ? [memory] : [];
      });
    }

    const keywordIds = cache.search(query, options.project, Math.max(limit * 4, 25), options.status ?? "active")
      .map((row) => row.id)
      .filter((id) => byId.has(id));
    const scores = new Map<string, number>();
    for (const ids of [keywordIds, semanticIds]) {
      ids.forEach((id, index) => scores.set(id, (scores.get(id) ?? 0) + 1 / (60 + index + 1)));
    }
    return [...scores].sort((a, b) => b[1] - a[1]).slice(0, limit).flatMap(([id]) => {
      const memory = byId.get(id);
      return memory ? [memory] : [];
    });
  } finally {
    cache.close();
  }
}
