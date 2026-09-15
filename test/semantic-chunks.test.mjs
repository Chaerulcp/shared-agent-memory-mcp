import test from "node:test";
import assert from "node:assert/strict";
import { semanticChunks } from "../dist/semantic-chunks.js";

test("overlapping chunks preserve a fact crossing the first boundary", () => {
  const content = `${"x".repeat(1195)}Rotate deployment keys weekly.`;
  const chunks = semanticChunks("Operations", content);
  assert.equal(chunks.length, 2);
  assert.ok(chunks.some((chunk) => chunk.includes("Rotate deployment keys weekly.")));
});

test("chunk offsets use Unicode code points consistently", () => {
  const chunks = semanticChunks("Emoji", "😀".repeat(1201));
  assert.equal(chunks.length, 2);
  assert.equal([...chunks[0].split("\n")[1]].length, 1200);
});
