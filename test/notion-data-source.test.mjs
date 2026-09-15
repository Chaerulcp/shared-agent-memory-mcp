import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@notionhq/client";
import { resolveDataSourceId } from "../dist/notion-data-source.js";
import { createMemoryDatabase } from "../dist/store.js";

function notionWith(sources) {
  return {
    databases: {
      retrieve: async ({ database_id }) => {
        assert.equal(database_id, "database-id");
        return { object: "database", data_sources: sources };
      },
    },
  };
}

test("single-source databases are discovered automatically", async () => {
  const id = await resolveDataSourceId(notionWith([{ id: "source-id", name: "Memory" }]), "database-id");
  assert.equal(id, "source-id");
});

test("an explicit data source selects a target in multi-source databases", async () => {
  const id = await resolveDataSourceId(notionWith([]), "database-id", "configured-source");
  assert.equal(id, "configured-source");
});

test("multi-source databases require an explicit target", async () => {
  await assert.rejects(
    resolveDataSourceId(notionWith([{ id: "one" }, { id: "two" }]), "database-id"),
    /NOTION_DATA_SOURCE_ID/
  );
});

test("database initialization creates an initial data source", async (t) => {
  process.env.NOTION_TOKEN = "test-token";
  t.after(() => delete process.env.NOTION_TOKEN);
  t.mock.method(Client.prototype, "request", async ({ path, method, body }) => {
    assert.equal(method, "post");
    assert.equal(path, "databases");
    assert.equal(body.properties, undefined);
    assert.ok(body.initial_data_source.properties.Name.title);
    return {
      object: "database",
      id: "database-id",
      url: "https://notion.example.test/database",
      data_sources: [{ id: "source-id", name: "Agent Memory" }],
    };
  });

  assert.deepEqual(await createMemoryDatabase("parent-id"), {
    id: "database-id",
    dataSourceId: "source-id",
    url: "https://notion.example.test/database",
  });
});
