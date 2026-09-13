# Shared Agent Memory MCP

[![CI](https://github.com/Chaerulcp/shared-agent-memory-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Chaerulcp/shared-agent-memory-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A shared, human-auditable memory service for MCP-compatible coding agents. Notion holds the authoritative records; a local SQLite FTS5 cache handles eligible keyword searches; an optional multilingual embedding model enables semantic and hybrid search; an Obsidian vault can mirror records as Markdown.

## What works today

- Six MCP tools: `memory_search`, `memory_recent`, `memory_get`, `memory_add`, `memory_update`, and `memory_delete`.
- One Notion database shared by Cline, OpenCode, Claude Code, Copilot, Hermes, and other MCP clients.
- Project, agent, category, tag, importance, and provenance metadata. Optional Notion properties are used when present in the database schema.
- A CLI for setup, CRUD, export, cache maintenance, diagnostics, conflict inspection, and Notion-to-Obsidian sync or watch.
- Conflict copies preserve manually edited Obsidian files during sync. Git commit and push for the vault are best-effort operations.

### Search and sync boundaries

`memory_search` and CLI `search` default to `keyword` mode. A fresh SQLite FTS5 cache handles eligible active-memory keyword queries; requests with unsupported cache filters or a stale cache query Notion instead. After writes, the cache is invalidated until the next `sync` or `cache rebuild`.

Set `mode` to `semantic` or `hybrid` in `memory_search`, or use CLI `search --mode semantic|hybrid`, to search a **fresh local cache** with the [multilingual MiniLM model](https://huggingface.co/Xenova/paraphrase-multilingual-MiniLM-L12-v2). Semantic mode ranks by embedding similarity; hybrid mode combines those results with FTS5 keyword results. The first such query downloads model files to the local model cache and embeds matching cached records, so it can take longer. Later queries reuse persisted record vectors; a changed title or content is re-embedded. Only the title and first 1,200 content characters are embedded. Memory text is processed locally, while downloading model files requires network access. Run `cache rebuild` or `sync` from the same working directory as the MCP server before using these modes. If the cache is stale or incomplete, they report an error instead of silently returning keyword-only results.

The older tiered-memory, incremental-index, ranking, `hybrid-search.ts`, and `vector-search.ts` modules remain experimental and are not used by the active search path. The older vector module still uses hash-based mock embeddings; the active semantic implementation is in `semantic-search.ts`. No reproducible end-to-end latency or scale benchmark is shipped.

Notion is the source of truth. `sync` and `watch` copy Notion records to Obsidian. Changes edited in Obsidian are **not written back to Notion**.

If a Markdown file was edited after its last sync, the next sync leaves it intact and writes the latest Notion version to a `.conflict.md` copy. Use `conflicts` to list these files and `resolve <path> --accept-notion` to apply the Notion version with a backup of the manual file. `--keep-obsidian` keeps the manual file; because Notion remains authoritative, a later sync can report the same conflict until the records agree. Git commits include the sync manifest and Markdown files with a Notion ID in their frontmatter; unrelated vault notes are left out. CLI warnings and the `obsidian.error`, `cache.error`, and `git` fields in MCP write results report mirror, cache, commit, or push failures. These local failures do not undo a completed Notion write; repair the local state and run `sync` rather than repeating `add`.

## Requirements

- Node.js 22 or newer
- A Notion integration token and a database shared with that integration
- Optional: an Obsidian vault backed by Git for Markdown mirroring

## Quick start

```powershell
git clone https://github.com/Chaerulcp/shared-agent-memory-mcp.git
cd shared-agent-memory-mcp
npm ci
npm run build
Copy-Item .env.example .env
# Set NOTION_TOKEN and NOTION_DATABASE_ID in .env
node dist/cli.js doctor
```

Create a Notion integration at [My Integrations](https://www.notion.so/my-integrations), then share the target database with it. To create a new memory database from an existing Notion parent page, set `NOTION_TOKEN` and run `npm run init-db -- <parent-page-url>`. See [Getting Started](./GETTING_STARTED.md) for setup details.

The `doctor` command checks credentials and Notion connectivity. `doctor --sync` also checks the optional vault, watcher, and cache; an unconfigured vault or stale cache can make that extended check report unhealthy.

## CLI examples

```powershell
node dist/cli.js add --title "Use TypeScript for API" --content "The API uses TypeScript." --agent shared --category decision --project backend-service
node dist/cli.js search "TypeScript API" --project backend-service
node dist/cli.js recent --limit 5
node dist/cli.js get YOUR_NOTION_PAGE_ID
node dist/cli.js update YOUR_NOTION_PAGE_ID --title "Use TypeScript for backend API"
node dist/cli.js delete YOUR_NOTION_PAGE_ID
node dist/cli.js cache rebuild
node dist/cli.js cache search "TypeScript"
node dist/cli.js search "cara memperbaiki mobil" --mode semantic --project backend-service
node dist/cli.js search "TypeScript API" --mode hybrid --project backend-service
node dist/cli.js sync --dry-run
```

`delete` archives by default; `--hard` moves the Notion page to trash. `cache rebuild` and `sync` read all Notion records. `sync --dry-run` only reads Notion and does not write the cache, vault, or Git.

For all commands and accepted values, run `node dist/cli.js --help`.

## MCP client setup

Use `node dist/index.js` as a stdio MCP server and pass `NOTION_TOKEN` and `NOTION_DATABASE_ID` through your client's environment or the local `.env` file. Never commit `.env` or put credentials in memory content.

Setup guides: [Claude Code](./docs/integrations/claude-code.md), [Codex CLI](./docs/integrations/codex-cli.md), [OpenCode](./docs/integrations/opencode.md), [Copilot CLI](./docs/integrations/copilot-cli.md), [Cline](./docs/integrations/cline.md), [Gemini CLI](./docs/integrations/gemini-cli.md), and [other clients](./docs/integrations/README.md). Example configurations are in [examples/mcp-configs](./examples/mcp-configs).

## Architecture

`src/index.ts` exposes the MCP tools. `src/store.ts` reads and writes Notion. `src/cache.ts` maintains the disposable SQLite FTS5 and embedding cache at `.cache/memory.sqlite`; `src/semantic-search.ts` runs the local model and ranks cached records. `src/obsidian.ts` writes the optional Markdown mirror and handles Git. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the data flows and cache policy.

## Validation

```powershell
npm test
```

The test script builds TypeScript and runs the repository's automated tests. Local model inference and MCP retrieval were also checked manually with an Indonesian-to-English paraphrase. The automated tests do not prove live Notion sync, production latency, or quality on a large memory collection; those require separate integration checks and benchmarks. CI also runs a production-dependency audit.

[v1.5.0 release notes](./RELEASE-NOTES-v1.5.0.md) summarize the current release. The [v1.4.0 development notes](./RELEASE-NOTES-v1.4.0.md) are historical and contain unverified performance claims.

## Contributing and support

See [CONTRIBUTING.md](./CONTRIBUTING.md), [SECURITY.md](./SECURITY.md), and [GitHub Issues](https://github.com/Chaerulcp/shared-agent-memory-mcp/issues).

Licensed under the [MIT License](./LICENSE).
