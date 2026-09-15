import type { Client } from "@notionhq/client";

type DatabaseReader = Pick<Client, "databases">;

export async function resolveDataSourceId(
  notion: DatabaseReader,
  databaseId: string,
  configuredId = ""
): Promise<string> {
  if (configuredId) return configuredId;

  const database = await notion.databases.retrieve({ database_id: databaseId });
  if (!("data_sources" in database)) {
    throw new Error("Respons Notion tidak memuat daftar data source.");
  }
  if (database.data_sources.length === 1) return database.data_sources[0].id;
  if (database.data_sources.length === 0) {
    throw new Error("Database Notion tidak memiliki data source.");
  }
  throw new Error(
    `Database Notion memiliki ${database.data_sources.length} data source. Set NOTION_DATA_SOURCE_ID agar target memori tidak ambigu.`
  );
}
