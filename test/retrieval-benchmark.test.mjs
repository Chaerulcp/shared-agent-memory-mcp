import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

test("retrieval benchmark runs a deterministic keyword baseline without Notion", () => {
  const result = spawnSync(process.execPath, [
    resolve("bench/retrieval-benchmark.mjs"),
    "--sizes", "100",
    "--modes", "keyword",
    "--repeats", "1",
  ], { encoding: "utf8", timeout: 30000 });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.fixture.queries, 16);
  assert.equal(report.results.length, 1);
  assert.equal(report.results[0].size, 100);
  assert.equal(report.results[0].mode, "keyword");
  assert.equal(report.results[0].queries, 16);
  assert.ok(report.results[0].recallAt5 > 0);
  assert.ok(report.results[0].recallAt5 >= 0 && report.results[0].recallAt5 <= 1);
  assert.ok(report.results[0].mrrAt10 >= 0 && report.results[0].mrrAt10 <= 1);
  assert.ok(report.results[0].sqliteBytes > 0);
});
