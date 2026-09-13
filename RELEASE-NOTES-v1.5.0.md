# v1.5.0 — Local semantic search and safer synchronization

Released 2026-09-13.

## Added

- Opt-in `semantic` and `hybrid` modes for MCP `memory_search` and CLI `search`. They use a local multilingual embedding model and a fresh SQLite cache. The first query downloads the model if it is not already cached; subsequent queries reuse stored memory embeddings.
- Keyword and semantic results are combined in hybrid mode, including archived records when `--all` is requested.

## Fixed

- `doctor` no longer prints any part of the Notion token.
- A successful Notion write remains a reported success when the Obsidian mirror or local cache update fails; CLI and MCP responses identify the local failure separately.
- Obsidian sync preserves manually edited files and refreshes the conflict copy when Notion changes again.
- Automatic vault Git commits include managed memory Markdown and the sync manifest, leaving unrelated notes untouched. A line containing `id:` in the body of a personal note no longer makes it a managed memory.
- Git commit and push failures are reported without undoing the Notion write.

## Upgrade

Node.js 22 or newer is required. Run `npm ci` and `npm run build` after pulling this release. Semantic and hybrid search require `sync` or `cache rebuild` from the same working directory as the MCP server before the first query. The Notion database schema does not require a migration.

## Verification

- `npm test`: 61 tests passed, including real temporary Git vault scenarios and CLI/MCP write-result checks.
- `npm audit --omit=dev`: 0 production dependency vulnerabilities.
- A live Notion add, update, read-back, and cleanup smoke test was completed during development. Model inference and MCP retrieval were also checked manually with a multilingual paraphrase.

The old tiered-memory and hash-vector modules remain experimental; their historical performance claims are not benchmarks for this release.
