import test from "node:test";
import assert from "node:assert/strict";
import { findDuplicateCandidates, normalizeMemoryText } from "../dist/memory-quality.js";

test("normalizeMemoryText is case and punctuation insensitive", () => {
  assert.equal(normalizeMemoryText("  Laravel: Use Vite! "), "laravel use vite");
});

test("findDuplicateCandidates detects a highly similar memory", () => {
  const candidates = findDuplicateCandidates(
    { title: "Use Laravel 12", content: "All projects use Laravel 12 and Vite", project: "crm" },
    [{ id: "1", title: "Laravel 12 for projects", content: "Projects use Laravel 12 with Vite", project: "crm" }],
  );
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].id, "1");
});

test("findDuplicateCandidates ignores unrelated projects", () => {
  const candidates = findDuplicateCandidates(
    { title: "Use Laravel 12", content: "All projects use Laravel 12", project: "crm" },
    [{ id: "1", title: "Use Laravel 12", content: "All projects use Laravel 12", project: "shop" }],
  );
  assert.equal(candidates.length, 0);
});
