import type { SemanticSearchResult } from "./semantic-search.js";

function keywordExcerpt(content: string, query: string): string {
  const terms = [query.trim(), ...query.trim().split(/\s+/)].filter(Boolean);
  const match = terms
    .map((term) => content.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "iu")))
    .find((result) => result !== null);
  const characters = Array.from(content);
  const start = match?.index === undefined ? 0 : Math.max(0, Array.from(content.slice(0, match.index)).length - 40);
  return characters.slice(start, start + 240).join("");
}

export function compactMemory(memory: SemanticSearchResult, query?: string) {
  const { content, match, ...metadata } = memory;
  return {
    ...metadata,
    excerpt: match?.excerpt ?? (query ? keywordExcerpt(content, query) : Array.from(content).slice(0, 240).join("")),
    ...(match ? { match: { start: match.start, end: match.end } } : {}),
  };
}
