export const SEMANTIC_CHUNK_SIZE = 1200;
export const SEMANTIC_CHUNK_STEP = 1000;

export function semanticChunks(title: string, content: string): string[] {
  const characters = Array.from(content);
  const chunks: string[] = [];
  for (let offset = 0; ; offset += SEMANTIC_CHUNK_STEP) {
    chunks.push(`${title}\n${characters.slice(offset, offset + SEMANTIC_CHUNK_SIZE).join("")}`);
    if (offset + SEMANTIC_CHUNK_SIZE >= characters.length) return chunks;
  }
}
