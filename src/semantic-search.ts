import { createHash } from "node:crypto";
import type { FeatureExtractionPipeline } from "@huggingface/transformers";
import { cachePath, createMemoryCache, memoryFromCache, type EmbeddingKey } from "./cache.js";
import { semanticChunks, SEMANTIC_CHUNK_SIZE, SEMANTIC_CHUNK_STEP } from "./semantic-chunks.js";
import type { Memory, SearchOptions } from "./store.js";

const MODEL = "Xenova/paraphrase-multilingual-MiniLM-L12-v2" as const;
const MODEL_KEY = `${MODEL}:q8:mean:chunks-v2` as const;

export type EmbedTexts = (texts: readonly string[]) => Promise<readonly Float32Array[]>;
export type SemanticSearchResult = Memory & {
  readonly match?: { readonly excerpt: string; readonly start: number; readonly end: number };
};

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

function withMatch(memory: Memory, chunkIndex: number): SemanticSearchResult {
  const characters = Array.from(memory.content);
  const start = chunkIndex * SEMANTIC_CHUNK_STEP;
  const end = Math.min(start + SEMANTIC_CHUNK_SIZE, characters.length);
  return { ...memory, match: { excerpt: characters.slice(start, end).join(""), start, end } };
}

export async function searchSemanticCache(
  options: SearchOptions,
  path = cachePath(),
  embed: EmbedTexts = embedTexts,
): Promise<SemanticSearchResult[]> {
  const query = options.query?.trim();
  if (!query) throw new Error("Semantic search requires a query");
  const cache = createMemoryCache(path);
  try {
    if (!cache.isFresh()) throw new Error("Semantic search requires a fresh cache; run cache rebuild or sync");
    if (!cache.hasMatchingRecords(options)) return [];
    const queryVector = (await embed([query]))[0];
    if (!queryVector?.length) throw new Error("Model embedding returned no query vector");
    const missing: Array<{ key: EmbeddingKey; text: string }> = [];
    for (const row of cache.listMissingEmbeddings(MODEL_KEY, queryVector.length, options)) {
      const memory = memoryFromCache(row);
      if (!memory) throw new Error("Semantic search requires complete cached memories; run cache rebuild");
      for (const [chunkIndex, text] of semanticChunks(memory.title, memory.content).entries()) {
        const key = {
          memoryId: memory.id, chunkIndex, model: MODEL_KEY,
          contentHash: createHash("sha256").update(text).digest("hex"),
        };
        if (cache.getEmbedding(key)?.length === queryVector.length) continue;
        missing.push({ key, text });
      }
    }
    for (let offset = 0; offset < missing.length; offset += 16) {
      const batch = missing.slice(offset, offset + 16);
      const embedded = await embed(batch.map((item) => item.text));
      if (embedded.length !== batch.length) throw new Error("Model embedding returned incomplete batch");
      for (let i = 0; i < batch.length; i++) {
        const item = batch[i];
        const vector = embedded[i];
        if (!vector || vector.length !== queryVector.length) throw new Error("Model embedding returned unexpected dimensions");
        cache.setEmbedding(item.key, vector);
      }
    }

    const limit = Math.min(Math.max(options.limit ?? 10, 1), 100);
    const semanticHits = cache.searchEmbeddingHits(MODEL_KEY, queryVector, options, options.mode === "hybrid" ? undefined : limit);
    if (options.mode !== "hybrid") {
      return semanticHits.flatMap((hit) => {
        const row = cache.getById(hit.id);
        const memory = row && memoryFromCache(row);
        if (!memory) throw new Error("Semantic search requires complete cached memories; run cache rebuild");
        return [withMatch(memory, hit.chunkIndex)];
      });
    }

    const semanticIds = semanticHits.map((hit) => hit.id);
    const matchedChunks = new Map(semanticHits.map((hit) => [hit.id, hit.chunkIndex]));
    const keywordIds = cache.search(query, options.project, Math.max(limit * 4, 25), options.status ?? "active")
      .flatMap((row) => {
        const memory = memoryFromCache(row);
        if (!memory) throw new Error("Semantic search requires complete cached memories; run cache rebuild");
        if (options.agent && memory.agent !== options.agent) return [];
        if (options.category && memory.category !== options.category) return [];
        if (options.tag && !memory.tags.includes(options.tag)) return [];
        return [memory.id];
      });
    const scores = new Map<string, number>();
    for (const ids of [keywordIds, semanticIds]) {
      ids.forEach((id, index) => scores.set(id, (scores.get(id) ?? 0) + 1 / (60 + index + 1)));
    }
    return [...scores].sort((a, b) => b[1] - a[1]).slice(0, limit).flatMap(([id]) => {
      const row = cache.getById(id);
      const memory = row && memoryFromCache(row);
      if (!memory) throw new Error("Semantic search requires complete cached memories; run cache rebuild");
      const chunkIndex = matchedChunks.get(id);
      return [chunkIndex === undefined ? memory : withMatch(memory, chunkIndex)];
    });
  } finally {
    cache.close();
  }
}
