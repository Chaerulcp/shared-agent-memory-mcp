export interface DuplicateInput {
  title: string;
  content: string;
  project?: string;
}

export interface DuplicateCandidate extends DuplicateInput {
  id: string;
}

export function normalizeMemoryText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u00e0-\u024f]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(normalizeMemoryText(value).split(" ").filter((token) => token.length > 2));
}

function similarity(a: DuplicateInput, b: DuplicateInput): number {
  const left = tokenSet(`${a.title} ${a.content}`);
  const right = tokenSet(`${b.title} ${b.content}`);
  if (!left.size || !right.size) return 0;
  let common = 0;
  for (const token of left) if (right.has(token)) common++;
  return common / Math.max(left.size, right.size);
}

export function findDuplicateCandidates(
  input: DuplicateInput,
  existing: DuplicateCandidate[],
  threshold = 0.55,
): DuplicateCandidate[] {
  return existing
    .filter((candidate) => !input.project || !candidate.project || candidate.project === input.project)
    .map((candidate) => ({ candidate, score: similarity(input, candidate) }))
    .filter(({ score }) => score >= threshold)
    .sort((a, b) => b.score - a.score)
    .map(({ candidate }) => candidate);
}
