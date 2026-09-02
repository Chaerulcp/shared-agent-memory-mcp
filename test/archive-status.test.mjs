import test from "node:test";
import assert from "node:assert/strict";
import { pageToMemory } from "../dist/store.js";

test("pageToMemory exposes archived Notion pages as archived", () => {
  const memory = pageToMemory({
    id: "11111111-2222-3333-4444-555555555555",
    archived: true,
    properties: {
      Name: { title: [{ plain_text: "Archived" }] },
      Content: { rich_text: [{ plain_text: "Archived content" }] },
      Agent: { select: { name: "shared" } },
      Category: { select: { name: "task" } },
      Tags: { multi_select: [] },
      Importance: { select: { name: "low" } },
      Status: { select: { name: "active" } },
    },
  });
  assert.equal(memory.status, "archived");
});
