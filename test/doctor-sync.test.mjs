import test from "node:test";
import assert from "node:assert/strict";
import { summarizeDoctorChecks } from "../dist/doctor.js";

test("summarizeDoctorChecks reports healthy when every check passes", () => {
  const result = summarizeDoctorChecks([
    { name: "Notion connection", ok: true, detail: "OK" },
    { name: "Vault", ok: true, detail: "OK" },
    { name: "Manifest", ok: true, detail: "47 entries" },
    { name: "Conflicts", ok: true, detail: "0" },
  ]);
  assert.equal(result.healthy, true);
  assert.equal(result.failed, 0);
});

test("summarizeDoctorChecks reports unhealthy when one check fails", () => {
  const result = summarizeDoctorChecks([
    { name: "Notion connection", ok: true, detail: "OK" },
    { name: "Manifest", ok: false, detail: "absolute path" },
  ]);
  assert.equal(result.healthy, false);
  assert.equal(result.failed, 1);
});
