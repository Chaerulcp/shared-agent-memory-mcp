export const PROVENANCE_SOURCES = ["agent", "user", "notion", "import", "system"] as const;
export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;

export type ProvenanceSource = (typeof PROVENANCE_SOURCES)[number];
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export interface ProvenanceInput {
  source?: string;
  confidence?: string;
  verifiedAt?: string;
  freshnessDays?: number;
  supersedes?: string;
}

export interface Provenance extends ProvenanceInput {
  source: string;
  confidence: string;
}

export function normalizeProvenance(input: ProvenanceInput = {}): Provenance {
  return {
    source: input.source?.trim() || "agent",
    confidence: input.confidence?.trim() || "medium",
    ...(input.verifiedAt ? { verifiedAt: input.verifiedAt } : {}),
    ...(input.freshnessDays !== undefined ? { freshnessDays: input.freshnessDays } : {}),
    ...(input.supersedes ? { supersedes: input.supersedes } : {}),
  };
}

export function freshnessState(input: { verifiedAt?: string; freshnessDays?: number }, now = Date.now()): "unknown" | "fresh" | "stale" {
  if (!input.verifiedAt || input.freshnessDays === undefined) return "unknown";
  const verified = Date.parse(input.verifiedAt);
  if (!Number.isFinite(verified) || input.freshnessDays < 0) return "unknown";
  return now - verified > input.freshnessDays * 24 * 60 * 60 * 1000 ? "stale" : "fresh";
}
