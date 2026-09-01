import test from "node:test";
import assert from "node:assert/strict";
import { projectFromRemote, normalizeProjectName } from "../dist/project-context.js";

test("projectFromRemote extracts owner and repository from HTTPS URL", () => {
  assert.equal(projectFromRemote("https://github.com/acme/crm.git"), "acme/crm");
});

test("projectFromRemote extracts owner and repository from SSH URL", () => {
  assert.equal(projectFromRemote("git@github.com:acme/crm.git"), "acme/crm");
});

test("normalizeProjectName removes unsafe whitespace", () => {
  assert.equal(normalizeProjectName("  CRM Project  "), "CRM Project");
});

test("projectFromRemote rejects unrelated remote formats", () => {
  assert.equal(projectFromRemote("https://example.com/repository"), undefined);
});
