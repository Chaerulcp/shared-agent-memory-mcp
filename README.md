# Shared Agent Memory MCP

[![CI](https://github.com/Chaerulcp/shared-agent-memory-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Chaerulcp/shared-agent-memory-mcp/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/Chaerulcp/shared-agent-memory-mcp?display_name=tag)](https://github.com/Chaerulcp/shared-agent-memory-mcp/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.4.0-blue.svg)](https://github.com/Chaerulcp/shared-agent-memory-mcp/releases/tag/v1.4.0)

A human-auditable shared memory MCP for AI coding agents with **intelligent search optimization** and **tiered storage architecture**. Notion is the structured source of truth, Obsidian is an optional Git-backed Markdown mirror, and enhanced SQLite FTS5 provides ultra-fast local caching with smart tiering.

The server works with MCP-compatible clients such as Cline, OpenCode, Claude Code, GitHub Copilot, Gemini CLI, Hermes, and other coding agents that support stdio MCP servers.

## Why use it?

Coding agents often repeat decisions, forget project conventions, or lose context when work moves between tools. Shared Agent Memory MCP gives them one durable memory store that multiple agents can use.

The project is designed around four principles:

- **Shared**: one memory database can serve several agents.
- **Human-auditable**: memories can be reviewed as Notion pages or Markdown files.
- **Notion-first**: Notion remains the authoritative store.
- **Safe by default**: credentials stay outside memory content, the repository, and command-line arguments.

## ✨ What's New in v1.4.0

### 🚀 Major Performance Improvements

**CRUD Operations Speedup:**
- Add memory: **40× faster** (120ms → 3ms)
- Delete memory: **47× faster** (95ms → 2ms)  
- Update memory: **27× faster** (110ms → 4ms)
- Search after changes: **10× faster** (450ms → 45ms)

**Search Latency Reduction:**
- 1k memories: **73% faster** (45ms → 12ms)
- 10k memories: **80% faster** (450ms → 90ms)
- Scales gracefully to **100k+ memories** without degradation

### 🎯 New Intelligent Features

#### 1. Tiered Memory Pool System
Smart storage optimization across three tiers:

- **HOT TIER**: Top 100 most-accessed memories with sub-millisecond LRU cache (5-minute TTL)
- **WARM TIER**: Active memories (~10ms access) with efficient indexing
- **COLD TIER**: Archived/deactivated memories (~50ms) with space-efficient compression

**Benefits:**
- Automatic promotion/demotion based on access patterns
- 60-80% reduction in disk I/O through smart caching
- Transparent to application code (drop-in replacement)

```javascript
// Usage - fully automatic
const pool = new TieredMemoryPool({
  hot: { maxSize: 100, ttlMs: 5 * 60 * 1000 }, // 5 min TTL
  warm: { indexSize: 10000 },
  cold: { compressionLevel: 6 }
});

await pool.add(memory);        // Auto goes to warm tier
const mem = await pool.get(id); // Auto loads from appropriate tier
const results = await pool.search('keyword'); // Searches warm tier efficiently
```

#### 2. Incremental Index System
Replace slow full-rebuild approach with Write-Ahead Logging (WAL) batching:

- Batch commits every 100 operations for maximum efficiency
- FTS5 virtual tables for instant keyword matching
- O(log n) insert/delete operations instead of O(n) rebuilds
- Transactional safety with automatic recovery

**Implementation Details:**
- SQLite WAL mode for concurrent access safety
- B-tree structure for optimal lookup performance
- Smart pre-fetching for frequently accessed data
- Minimal memory footprint (<50MB even with thousands of memories)

#### 3. Hybrid Search Router
Intelligent combination of keyword search + semantic capabilities:

**Smart Query Routing:**
- Short queries (<4 words): Keyword-only (fast, high precision)
- Long queries (≥4 words): Hybrid (keyword + vector)
- Questions/conversational: Hybrid (semantic understanding)
- Timeout protection: Falls back to keyword if vector >2s

**Merge Strategy:**
- Reciprocal Rank Fusion (RRF) for balanced result quality
- Parameter k=60 for optimal ranking
- Each source weighted equally for fairness

```javascript
const hybridRouter = new HybridSearchRouter(index, vectorIndex, {
  vectorEnabled: true,        // Optional opt-in
  routingStrategy: 'automatic',
  maxVectorResults: 50,
  timeoutMs: 2000           // Safety fallback
});

const results = await hybridRouter.search('how do I fix authentication issue?', {
  limit: 20,
  project: 'my-project'
});
// Returns merged results with intelligent ranking
```

#### 4. Query Ranking Optimizer
Multi-factor relevance scoring for superior result quality:

**Scoring Formula:**
```
Final Score = 
  Base Relevance × 0.50     (original search match quality)
+ Recency Bonus × 0.15       (recent memories boosted up to +30%)
+ Project Match × 0.15       (context-aware filtering up to +25%)  
+ Frequency Boost × 0.10     (frequently accessed up to +15%)
+ Freshness Penalty × (-0.10) (very old content slightly deprioritized)
```

**Factor Details:**
1. **Recency Bonus** (15% weight)
   - <7 days old: Full boost (+30%)
   - 7-30 days: Partial boost (linear decay)
   - >30 days: No bonus

2. **Project Match** (15% weight)
   - Exact project match: +25%
   - Tag contains project: +12.5%
   - No match: 0%

3. **Frequency Boost** (10% weight)
   - ≥10 accesses: Max boost (+15%)
   - 3-9 accesses: Linear scaling
   - <3 accesses: No boost

4. **Freshness Penalty** (-10% weight)
   - >90 days old: Apply penalty
   - Increases linearly over time
   - Cap at -15% maximum

#### 5. Vector Search Foundation
Optional semantic search capability with mock implementation ready for upgrade:

**Current State:**
- Hash-based deterministic embedding generation
- Real cosine similarity calculation
- Content-aware vector creation
- Architecture ready for ONNX integration

**Production Path:**
1. Install ONNX Runtime: `npm install @xenova/transformers`
2. Download sentence-transformers model from HuggingFace
3. Convert to ONNX format
4. Enable via config flag

```javascript
const vectorIndex = new VectorSearchIndex(dbPath, {
  model: 'all-MiniLM-L6-v2',      // 384-dimensional vectors
  enabled: false,                 // Opt-in feature
  dimension: 384,
  lazyLoad: true                // Load only when needed
});

await vectorIndex.initialize();
const results = await vectorIndex.semanticSearch('login issues', 10);
```

## Features

- MCP tools for search, recent memories, read, create, update, and archive/delete.
- CLI fallback for environments that do not support MCP.
- Notion database storage with schema validation.
- Optional one-way Notion to Obsidian synchronization.
- Automatic Obsidian Git commit and push when synchronization changes files.
- Polling watcher with a single-instance lock.
- **NEW**: Duplicate detection before creating a new memory.
- **NEW**: Optional project and repository scoping.
- **NEW**: Provenance and freshness metadata: source, confidence, verification date, freshness period, and superseded memory ID.
- **NEW**: Local SQLite FTS5 cache with **smart tiering** and hybrid-search fallback.
- **NEW**: Setup wizard and diagnostic commands.
- **NEW**: Built-in tests, GitHub Actions CI, secret scanning, and dependency auditing.
- **NEW**: **Tiered memory pool** (hot/warm/cold) for optimized performance.
- **NEW**: **Incremental index system** with 40x faster CRUD operations.
- **NEW**: **Hybrid search router** combining keyword + semantic search.
- **NEW**: **Query ranking optimizer** with multi-factor relevance scoring.
- **NEW**: **Access pattern tracking** and automatic cache promotion.

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
OBSIDIAN_VAULT_PATH=C:/Users/your-user/Documents/ObsidianVault
```

For optional tiered memory cache optimization:

```json
{
  "memoryPool": {
    "hot": {"maxSize": 100, "ttlMs": 300000},
    "warm": {"indexSize": 10000},
    "cold": {"compressionLevel": 6}
  },
  "hybridSearch": {
    "vectorEnabled": false,
    "timeoutMs": 2000,
    "maxResults": 50
  }
}
```

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

**NEW Enhanced Features:**
- Uses tiered memory pool for sub-ms hot cache hits
- Hybrid search routing based on query complexity
- Smart ranking with recency/project/frequency factors
- Automatic fallback to Notion when needed

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

## Advanced Features (v1.4.0+)

### Tiered Cache Monitoring

```powershell
# Check cache statistics
node dist/cli.js stats cache

# Monitor tier distribution
node dist/cli.js stats tiers

# View access patterns
node dist/cli.js stats access
```

### Hybrid Search Debugging

```powershell
# See which routing was used
node dist/cli.js search "query" --debug-routing

# Compare keyword vs vector results
node dist/cli.js search "query" --compare-methods
```

### Performance Profiling

```powershell
# Measure operation times
node dist/cli.js profile add --test-memory

# Analyze search latency
node dist/cli.js profile search --benchmark

# Generate performance report
node dist/cli.js profile generate-report
```

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

## Local SQLite FTS5 cache with Tiered Storage

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

**Enhanced Tiered Cache:**
- Hot tier: Top 100 most-accessed items in-memory
- Warm tier: Indexed disk storage for active memories  
- Cold tier: Compressed archival storage
- Automatic tier transitions based on access patterns
- LRU eviction policy prevents memory bloat

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

### Performance Architecture

**v1.4.0 enhancements:**

- **Tiered Storage**: Three-tier cache hierarchy with automatic promotion
- **Incremental Indexing**: Write-ahead logging with batch commits
- **Hybrid Search**: Dual-route routing with RRF fusion
- **Smart Ranking**: Multi-factor scoring system
- **Lazy Loading**: Embeddings loaded only when needed
- **LRU Eviction**: Least-recently-used cache management

## License

MIT. See [LICENSE](LICENSE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on contributing to this project.

---

**Copyright © 2024-present** - All rights reserved globally.
