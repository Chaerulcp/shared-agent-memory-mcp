// Cari page & database yang bisa diakses integrasi
import { Client } from "@notionhq/client";
import { loadConfig } from "../dist/config.js";

const { notionToken } = loadConfig();
const notion = new Client({ auth: notionToken });

const res = await notion.search({ page_size: 50 });
if (!res.results.length) {
  console.log("TIDAK ADA page/database yang bisa diakses integrasi.");
  console.log("=> Share dulu page ke integration: Page > ... > Connections > Memori AGENT AI");
} else {
  for (const r of res.results) {
    const title =
      r.object === "page"
        ? (r.properties?.title?.title?.[0]?.plain_text ??
          r.properties?.Name?.title?.[0]?.plain_text ??
          "(tanpa judul)")
        : (r.title?.[0]?.plain_text ?? "(tanpa judul)");
    console.log(`${r.object.toUpperCase().padEnd(8)} | ${r.id} | ${title}`);
    console.log(`           url: ${r.url}`);
  }
}
