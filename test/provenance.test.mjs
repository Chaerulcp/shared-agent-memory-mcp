import test from "node:test";
import assert from "node:assert/strict";
import { freshnessState, normalizeProvenance } from "../dist/provenance.js";

test("normalizeProvenance supplies safe defaults", () => {
  assert.deepEqual(normalizeProvenance({}), {
    source: "agent",
    confidence: "medium",
  });
});

test("freshnessState marks expired verification as stale", () => {
  const old = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(freshnessState({ verifiedAt: old, freshnessDays: 30 }), "stale");
});

test("freshnessState marks recent verification as fresh", () => {
  const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(freshnessState({ verifiedAt: recent, freshnessDays: 30 }), "fresh");
});
