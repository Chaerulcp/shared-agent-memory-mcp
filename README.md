# Shared Agent Memory MCP

[![CI](https://github.com/Chaerulcp/shared-agent-memory-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Chaerulcp/shared-agent-memory-mcp/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/Chaerulcp/shared-agent-memory-mcp?display_name=tag)](https://github.com/Chaerulcp/shared-agent-memory-mcp/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A human-auditable shared memory MCP for AI coding agents. Notion is the structured source of truth, Obsidian is an optional Git-backed Markdown mirror, and SQLite FTS5 provides a local search cache.

The server works with MCP-compatible clients such as Cline, OpenCode, Claude Code, GitHub Copilot, Gemini CLI, Hermes, and other coding agents that support stdio MCP servers.

## Why use it?

Coding agents often repeat decisions, forget project conventions, or lose context when work moves between tools. Shared Agent Memory MCP gives them one durable memory store that multiple agents can use.

The project is designed around four principles:

- **Shared**: one memory database can serve several agents.
- **Human-auditable**: memories can be reviewed as Notion pages or Markdown files.
- **Notion-first**: Notion remains the authoritative store.
- **Safe by default**: credentials stay outside memory content, the repository, and command-line arguments.

## Features

- MCP tools for search, recent memories, read, create, update, and archive/delete.
- CLI fallback for environments that do not support MCP.
- Notion database storage with schema validation.
- Optional one-way Notion to Obsidian synchronization.
- Automatic Obsidian Git commit and push when synchronization changes files.
- Polling watcher with a single-instance lock.
- Duplicate detection before creating a new memory.
- Optional project and repository scoping.
- Provenance and freshness metadata: source, confidence, verification date, freshness period, and superseded memory ID.
- Local SQLite FTS5 cache with a conservative hybrid-search fallback to Notion.
- Setup wizard and diagnostic commands.
- Built-in tests, GitHub Actions CI, secret scanning, and dependency auditing.

## Requirements

- Node.js 22 or newer.
- A Notion integration with access to a database.
- Git, if you use the Obsidian mirror.
- An Obsidian vault initialized as a Git repository, if you use automatic mirror sync.

Node.js 22 is required because the project uses `better-sqlite3` 13 for the local FTS5 cache.

## Installation

```powershell
git clone https://github.com/Chaerulcp/shared-agent-memory-mcp.git
cd shared-agent-memory-mcp
npm install
npm run build
```

The package is also available through the GitHub repository. The current repository does not publish a registry package yet, so use the cloned project path in MCP client configuration.

## Configuration

Copy `.env.example` to `.env` and set the required values:

```dotenv
NOTION_TOKEN=your_notion_integration_token
NOTION_DATABASE_ID=your_notion_database_id
```

For the optional Obsidian mirror:

```dotenv
OBSIDIAN_VAULT_PATH=C:/Users/your-user/Documents/ObsidianVault
```

The application reads environment variables first and loads `.env` as a local fallback. Never commit `.env`, place credentials in memory content, or pass tokens as command-line arguments.

Check the local setup without modifying data:

```powershell
npm run setup -- --dry-run
```

Run the full setup check when you are ready:

```powershell
npm run setup
```

The setup wizard checks the project, build output, `.env`, Notion configuration, Obsidian vault, and Git remote. It does not create a Notion database or change agent configuration.

## Notion setup

1. Create an integration at [Notion integrations](https://www.notion.so/profile/integrations).
2. Create a page where the memory database will live.
3. Share the page or database with the integration.
4. Create the database with the project command, or use an existing compatible database.
5. Put the database ID in `.env`.
6. Verify access:

```powershell
npm run doctor
```

Create a new database below a parent page:

```powershell
npm run init-db -- https://www.notion.so/your-parent-page
```

The generated database includes these properties:

| Property | Type | Purpose |
|---|---|---|
| `Name` | Title | Short searchable memory title |
| `Content` | Rich text | Durable memory content |
| `Agent` | Select | Agent that saved the memory |
| `Category` | Select | Preference, decision, convention, bugfix, and other categories |
| `Tags` | Multi-select | Searchable labels |
| `Importance` | Select | High, medium, or low |
| `Status` | Select | Active or archived |
| `Project` | Rich text | Optional repository or project scope |
| `Source` | Select | Agent, user, Notion, import, or system |
| `Confidence` | Select | High, medium, or low |
| `Verified At` | Date | Last verification timestamp |
| `Freshness Days` | Number | Number of days before the memory becomes stale |
| `Supersedes` | Rich text | ID of an older memory replaced by this memory |
| `Created` | Created time | Notion-managed creation time |
| `Updated` | Last edited time | Notion-managed edit time |

Existing databases may omit the optional fields. The server remains backward compatible and only writes optional fields when those properties exist.

## MCP client configuration

Build the project first, then register the absolute path to `dist/index.js` in your MCP client. The server uses stdio transport.

Generic configuration:

```json
{
  "mcpServers": {
    "shared-agent-memory": {
      "transport": {
        "type": "stdio",
        "command": "node",
        "args": ["C:/path/to/shared-agent-memory-mcp/dist/index.js"]
      }
    }
  }
}
```

Provide `NOTION_TOKEN` and `NOTION_DATABASE_ID` through the client's environment settings or the local `.env` file. Do not put credentials in the JSON example above.

Restart the client after changing MCP configuration. Most clients do not reload MCP tools automatically.

The repository contains example agent configuration files under `agents/`. Treat them as templates: replace the placeholder path and provide credentials through a secure local environment.

## MCP tools

### `memory_search`

Search active memories by text. Optional filters include agent, category, tag, project, and result limit. Searches that need archived memories or unsupported filters use live Notion search.

### `memory_recent`

List recently updated active memories, optionally filtered by agent.

### `memory_get`

Retrieve one memory by its Notion page ID.

### `memory_add`

Create a durable memory. Required fields are `title`, `content`, and `agent`. Optional fields include category, tags, importance, project, source, confidence, verification date, freshness period, and superseded memory ID.

The server checks for similar active memories before creating a page. If a likely duplicate is found, it returns candidate IDs so the agent can update the existing memory. Set `allowDuplicate: true` only when the new memory is intentionally separate.

### `memory_update`

Update an existing memory, including its project and provenance metadata. Prefer this over creating a second memory when a decision has changed.

### `memory_delete`

Archive a memory by default. A hard delete requests removal from Notion when the API supports it; use this carefully.

## CLI usage

The executable is available after building as `node dist/cli.js` or through the package bin name `agent-memory`.

```powershell
node dist/cli.js doctor
node dist/cli.js doctor --sync
node dist/cli.js search "laravel deployment"
node dist/cli.js search "deployment" --project crm --limit 10
node dist/cli.js recent --limit 5
node dist/cli.js get <notion-page-id>
node dist/cli.js add --title "Use plan before implementation" --content "Review a plan before editing project files." --agent shared --category convention --importance high --project crm
node dist/cli.js update <notion-page-id> --status archived
node dist/cli.js delete <notion-page-id>
node dist/cli.js export --out memories.json
```

Use `--json` for machine-readable output where supported. Long content can be supplied with `--content-file <path>`.

## Project scope, duplicates, and freshness

Use a stable repository or project identifier, not a temporary branch name, for `project`. This keeps memories from unrelated projects separate.

When `project` is omitted from `memory_add`, the server resolves it automatically in this order: an explicit `AGENT_PROJECT` environment variable, the GitHub `origin` remote as `owner/repository`, or the local Git root directory name. If the current directory is not a Git repository, the project field remains empty. An explicit `project` value always wins.

For `memory_search`, automatic scope is opt-in. Set `currentProject: true` in the MCP request or pass `--current-project` to the CLI. A supplied `project` value has priority over automatic detection; without either option, search remains global for backward compatibility.

To force a stable project name when an agent runs from a different working directory, set this local environment variable:

```dotenv
AGENT_PROJECT=acme/crm
```

The resolver only reads local Git metadata. It does not execute remote URLs or inspect repository contents.


```json
{
  "title": "Use Laravel 12",
  "content": "The CRM project uses Laravel 12 and Vite.",
  "agent": "shared",
  "category": "convention",
  "project": "crm",
  "source": "user",
  "confidence": "high",
  "verifiedAt": "2026-09-01T13:00:00.000Z",
  "freshnessDays": 90,
  "allowDuplicate": false
}
```

Memory results include a freshness state:

- `fresh`: verification is within the configured freshness period.
- `stale`: the period has elapsed.
- `unknown`: no usable verification metadata exists.

Older databases without these fields continue to work and return `unknown` freshness.

## Obsidian mirror and automatic synchronization

The synchronization direction is deliberately one way:

```text
Notion -> Obsidian Markdown -> Git commit -> Git push
```

Notion remains the source of truth. Manual edits in Obsidian are not imported back into Notion.

Configure the vault:

```dotenv
OBSIDIAN_VAULT_PATH=C:/Users/your-user/Documents/ObsidianVault
```

The vault must be a Git repository with a configured remote:

```powershell
cd C:/Users/your-user/Documents/ObsidianVault
git init
git remote add origin https://github.com/your-user/your-vault.git
```

Run a one-time synchronization:

```powershell
npm run sync
```

Run the polling watcher. The minimum interval is 30 seconds and the default is 300 seconds:

```powershell
npm run watch
```

The watcher uses a lock file to prevent duplicate instances. Its log is written to `watcher.log` when launched through the provided Windows startup script. A failed Git push leaves the local commit in place for a later retry.

Preview a synchronization without writing files, Git, or the cache:

```powershell
node dist/cli.js sync --dry-run
```

### Establishing a baseline

For an existing vault that was synchronized before conflict protection was enabled, create a baseline before the next normal sync:

```powershell
node dist/cli.js sync --init-baseline
```

This command scans existing `memories/**/*.md` files, records their SHA-256 hashes, and does not call Notion or modify Markdown files. It requires a clean Obsidian Git working tree and refuses to replace an existing manifest unless `--force` is supplied. Back up the vault before the first baseline operation.

The manifest is stored as `.shared-agent-memory-sync.json` at the vault root and contains relative paths only. It is derived state and can be rebuilt from the current mirror when necessary.

### Conflict protection

The sync process records the SHA-256 hash of each successfully synchronized Markdown file in `.shared-agent-memory-sync.json` at the vault root. On a later sync, if a file differs from its last synchronized hash, the file is treated as manually edited:

- The existing Obsidian file is preserved.
- The current Notion version is written to a stable sibling file ending in `.conflict.md` (repeated syncs do not create duplicate conflict copies).
- The CLI reports the conflict and exits with code `2`.
- The watcher logs the conflict instead of silently overwriting the edit.

Review the two files and resolve them explicitly:

```powershell
node dist/cli.js conflicts
node dist/cli.js resolve memories/category/file.md.conflict.md --accept-notion
node dist/cli.js resolve memories/category/file.md.conflict.md --keep-obsidian
```

`--accept-notion` backs up the existing Obsidian file under `backups/<timestamp>/` before applying the conflict copy. `--keep-obsidian` removes only the conflict copy and preserves the manual file. Paths are restricted to vault-relative `memories/` paths. To deliberately replace manual edits with the current Notion version, use:

```powershell
node dist/cli.js sync --force
```

`--force` should only be used after reviewing the affected files. The manifest is local derived state, can be deleted safely, and will be rebuilt by the next successful synchronization. Notion remains the source of truth; Obsidian edits are never imported into Notion automatically.

The conflict manifest and conflict copies are kept in the Obsidian vault, not in this source repository.

```text
Notion version -> unchanged mirror file: update safely
Notion version -> manually edited mirror: preserve edit + write conflict copy
Notion version -> --force: overwrite mirror intentionally
```


For Windows auto-start, use the startup script in the user's Startup folder or create a Task Scheduler task with appropriate permissions. Do not claim Task Scheduler is configured unless the task has been verified successfully.

## Local SQLite FTS5 cache

The local cache is stored at `.cache/memory.sqlite` and is excluded from Git. It is disposable and can always be rebuilt from Notion.

```powershell
node dist/cli.js cache rebuild
node dist/cli.js cache status
node dist/cli.js cache search "laravel deployment"
node dist/cli.js cache clear
```

The MCP search path uses the cache only when all of these conditions hold:

- The query is a text query for active memories.
- The cache snapshot is no older than five minutes.
- The query does not use agent, category, or tag filters.
- The cached row contains the complete memory payload.

Otherwise, the request falls back to Notion. Project filtering is supported by the cache. `memory_add`, `memory_update`, and `memory_delete` clear the cache after a successful write. A normal `sync` rebuilds it from the latest Notion snapshot; `sync --dry-run` does not change it.

## Security and privacy

- Keep `.env` out of version control.
- Never store API keys, tokens, passwords, cookies, or connection strings in memory content.
- Do not put credentials in MCP configuration examples, issue reports, logs, or screenshots.
- Share the Notion database only with the intended integration.
- Review memories before exporting or publishing the Obsidian vault.
- Review dependency changes and run `npm audit` before releases.

Read [SECURITY.md](SECURITY.md) for vulnerability reporting.

## Troubleshooting

### `NOTION_TOKEN` is missing

Create `.env` from `.env.example`, set the token locally, and run `npm run doctor`. If the client launches the server itself, provide the variables through that client's secure environment configuration.

### `NOTION_DATABASE_ID` is missing

Run `npm run init-db -- <parent-page-url>` or set the ID of an existing shared database in `.env`.

### Notion returns an access error

Open the target database in Notion, share it with the integration, confirm the database ID, and run `npm run doctor` again.

### The cache returns no results

Run `node dist/cli.js cache status`. If the cache is empty or stale, run `node dist/cli.js cache rebuild`. Live MCP search falls back to Notion when the cache cannot be trusted.

### Obsidian files do not update

Check `OBSIDIAN_VAULT_PATH`, confirm the path is a Git repository, verify the remote with `git remote -v`, and run `node dist/cli.js sync --dry-run` before running a normal sync.

### The watcher appears to do nothing on Windows

The startup script intentionally runs hidden. Check `watcher.log`, verify that only one watcher is active, and inspect the lock file inside the configured vault.

### Run the full synchronization health check

Use the extended doctor command before or after maintenance:

```powershell
node dist/cli.js doctor --sync
```

It checks Notion configuration and connectivity, database access, record count, vault availability, manifest validity and absolute paths, active conflicts, Git cleanliness, watcher lock/PID, and cache freshness. The command exits with code `1` when any check fails and prints `Overall: HEALTHY` only when all checks pass.

Recovery sequence:

1. If the watcher check reports a stale PID, confirm the PID is not a running `dist/cli.js watch` process, then remove only the lock file.
2. If the manifest is invalid or contains wrong paths, back up the vault and run `node dist/cli.js sync --init-baseline --force` only after reviewing the current files.
3. If conflicts are reported, use `node dist/cli.js conflicts` and resolve each file with `--accept-notion` or `--keep-obsidian`.
4. If the cache is stale or empty, run `node dist/cli.js cache rebuild`; the cache is disposable and Notion remains authoritative.
5. Run `node dist/cli.js sync` and then repeat `node dist/cli.js doctor --sync`.

Never delete production memory records merely to clear a diagnostic failure. Use a clearly labeled temporary smoke-test record for lifecycle testing, and verify the Notion, mirror, manifest, and Git state after every operation.

## Development

```powershell
npm install
npm run build
npm test
npm audit --omit=dev
git diff --check
```

The test suite uses Node's built-in test runner. CI runs the build, tests, production dependency audit, and credential-pattern scan.

## Versioning and releases

The project follows Semantic Versioning. The stable baseline release is [v1.0.0](https://github.com/Chaerulcp/shared-agent-memory-mcp/releases/tag/v1.0.0). See [CHANGELOG.md](CHANGELOG.md) for changes after that baseline.

Do not commit generated `dist/` output, `.env`, SQLite files, logs, or local IDE data. Follow [CONTRIBUTING.md](CONTRIBUTING.md) for pull requests.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for components, data flow, cache consistency, and failure behavior.

## License

MIT. See [LICENSE](LICENSE).
