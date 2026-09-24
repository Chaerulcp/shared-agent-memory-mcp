# Changelog

All notable changes to this project are documented here.

The project follows Semantic Versioning. The `v1.1.0` release includes the post-baseline reliability, retrieval, setup, and project-context improvements.

## [Unreleased]

## [1.6.2] - 2026-09-24

### Changed

- Cleaned the documentation set to remove stale release-note files and duplicated historical summaries.
- Normalized the onboarding and integration guides to match the actual MCP tools, environment variables, and repository status.
- Removed fake SDK/client examples and aligned the client capability notes with the real server contract.

## [1.6.1] - 2026-09-23

### Changed

- Package is prepared for public npm distribution as `@chaerulcp/shared-agent-memory-mcp` with a curated tarball, npm metadata, and `agent-memory` and `notion-memory` executables.

## [1.6.0] - 2026-09-15

### Added

- Support for Notion data sources, including automatic selection for a single source and explicit `NOTION_DATA_SOURCE_ID` selection for multi-source databases.
- Retry-safe `memory_add` writes through an idempotency key and local operation journal.
- Compact MCP search and recent responses, matched semantic excerpts, and Unicode-aware chunked embeddings for long memories.
- Reproducible retrieval benchmarks and evaluation fixtures.

### Changed

- Semantic retrieval now uses `sqlite-vec` ranking and invalidates cached vectors when memory content changes.
- The local cache has a stable installation-relative default path and supports an absolute `MEMORY_CACHE_PATH` override.
- The sync watcher waits for each sync to finish before scheduling another cycle and releases its lock on shutdown.

## [1.5.0] - 2026-09-13

### Added

- Opt-in local semantic and hybrid search for MCP and CLI, with reusable SQLite embedding vectors.

### Fixed

- Hide the Notion token in `doctor` output.
- Report Obsidian, cache, and Git failures separately from successful Notion writes.
- Preserve manual Obsidian edits, refresh conflict copies, and exclude personal notes from automatic Git commits and orphan cleanup.

### Verification

- 61 automated tests passed; live Notion and local Git-vault smoke checks were completed.
- Production dependency audit reported 0 vulnerabilities.

## [1.4.0] - 2026-09-02

Introduced experimental tiered-memory, index, ranking, hybrid, and vector modules. Their performance figures are not verified end-to-end benchmarks.

## [1.3.1] - 2026-09-02

Patch release fixing production archive and conflict lifecycle consistency.

### Fixed

- Archived Notion pages are exposed as `archived` even when the Status property is stale.
- Dashed and compact Notion IDs resolve to the same Obsidian mirror file.
- Archived and hard-deleted records remove matching manifest entries.
- Sync reconciles active mirror files and stale conflict copies whose source records are no longer active.
- Updating a memory now uses conflict protection instead of overwriting manual Obsidian edits directly.

### Verification

- 35 automated tests passed.
- Direct production archive, hard-delete fallback, conflict, repeated-sync, keep-local, accept-source, backup, and force tests passed.
- Production sync is idempotent with zero conflicts.
- Production cache clear and rebuild passed.

## [1.3.0] - 2026-09-02

Minor release adding synchronization diagnostics and recovery guidance.

### Added

- `doctor --sync` health checks for Notion, vault, manifest, conflicts, Git, watcher, and cache.
- Machine-testable doctor health summary with a non-zero exit code when unhealthy.
- Recovery runbook for stale locks, invalid manifests, conflicts, and cache rebuilds.

### Verification

- 30 automated tests passed.
- Production `doctor --sync` reported `Overall: HEALTHY`.
- Production sync completed for 49 memories with zero conflicts.
- Manifest contained zero absolute paths.
- `npm audit --omit=dev` reported 0 vulnerabilities.

## [1.2.3] - 2026-09-02

Patch release fixing archived-memory mirror cleanup after a direct production lifecycle test.

### Fixed

- Archived memories are no longer rediscovered as active Obsidian files during synchronization.
- Archiving a memory now removes its entry from `.shared-agent-memory-sync.json`.
- Added regression coverage for the full local archive lifecycle.

### Verification

- 28 automated tests passed.
- Direct production `add → read-back → update → archive → sync` test passed after the fix.
- Production sync completed for 47 memories with zero conflicts.
- `conflicts --json` returned an empty list.
- `npm audit --omit=dev` reported 0 vulnerabilities.
- `git diff --check` passed.

## [1.2.2] - 2026-09-02

Patch release fixing a Windows manifest portability regression.

### Fixed

- Synchronization now consistently stores relative paths in `.shared-agent-memory-sync.json`, including watcher-generated updates.
- Windows path separators and case differences are normalized safely.
- Added regression coverage for baseline and sync manifest paths.

### Verification

- 27 automated tests passed.
- Real baseline test with a temporary Git vault passed.
- Production sync completed for 46 files with zero conflicts.
- Production manifest contains zero absolute paths.
- `npm audit --omit=dev` reported 0 vulnerabilities.
- Secret scan and `git diff --check` passed.

## [1.2.1] - 2026-09-02

Patch release restoring relative-path portability in synchronization manifests.

### Fixed

- Sync now consistently stores vault-relative paths in `.shared-agent-memory-sync.json`, including watcher-generated updates on Windows.
- Added regression coverage preventing absolute local paths from entering the manifest.

### Verification

- 27 automated tests passed.
- `npm audit --omit=dev` reported 0 vulnerabilities.
- Secret scan and `git diff --check` passed.
- Production dry-run and conflict listing remained safe.

## [1.2.0] - 2026-09-02

Stable feature release for operationally safe Obsidian synchronization.

### Added

- Timestamped Obsidian backups before replacing changed files during sync.
- `conflicts` command to list unresolved conflict copies.
- `resolve` command with explicit `--accept-notion` and `--keep-obsidian` actions.
- Path validation that restricts conflict resolution to vault-relative memory files.

### Safety

- Accepting the Notion version preserves the existing Obsidian file in `backups/<timestamp>/` before replacement.
- Keeping the Obsidian version removes only the conflict copy.
- Notion remains the source of truth; no automatic Obsidian-to-Notion import was added.

### Verification

- 26 automated tests passed.
- Backup and both conflict resolution paths passed real filesystem integration tests.
- Unsafe path traversal was rejected.
- Production dry-run detected 46 memories without changing files, Git, or cache.
- Production conflict listing returned zero unresolved conflicts.
- `npm audit --omit=dev` reported 0 vulnerabilities.
- Credential-pattern scan and `git diff --check` passed.
- GitHub Actions CI passed.

## [1.1.2] - 2026-09-01

Patch release that fixes false Obsidian conflicts for newly created memories.

### Fixed

- Existing Obsidian files without a manifest entry are now compared with the expected Notion content before being classified as conflicts.
- Newly synchronized files that already match Notion are adopted into the manifest without creating unnecessary `.conflict.md` files.
- Repeated watcher cycles no longer report false conflicts for identical files.

### Verification

- 23 automated tests passed.
- Real production sync completed with 45 files and 0 conflicts.
- Repeated sync remained stable with 45 files and 0 conflicts.
- `npm audit --omit=dev` reported 0 vulnerabilities.
- Credential-pattern scan passed.
- GitHub Actions CI passed for the fix commit.

### Compatibility

- `v1.1.1` remains unchanged and its tag continues to point to the original patch release.
- Notion remains the source of truth.
- Existing `.shared-agent-memory-sync.json` manifests remain compatible.


## [1.1.1] - 2026-09-01

Patch release that adds safe Obsidian conflict handling and production baseline support without changing the `v1.1.0` tag.

### Added

- Obsidian conflict protection using a local SHA-256 synchronization manifest.
- `sync --init-baseline` to record existing mirror files without calling Notion or modifying Markdown.
- Conflict copies for manually edited mirror files instead of silent overwrites.
- `sync --force` for deliberate replacement after review.
- Stable `.conflict.md` conflict filenames so repeated watcher cycles do not create unbounded duplicates.
- CLI startup now loads the project `.env` before resolving the Obsidian vault path.

### Changed

- Sync reports conflicts with exit code `2`; the original manually edited file is preserved.
- Baseline manifest entries use relative paths rather than personal absolute filesystem paths.
- Existing vaults without a baseline are handled conservatively and require explicit `--force` to overwrite existing files.

### Compatibility

- Notion remains the source of truth; the manifest and Obsidian mirror are derived data.
- Existing Notion databases and clients remain supported.
- `v1.1.0` remains unchanged and its tag continues to point to the original release commit.

### Verification

- 23 automated tests passed.
- `npm audit --omit=dev` reported 0 vulnerabilities.
- Credential-pattern scan passed.
- Production vault baseline created for 43 memory files after a verified backup.
- Obsidian vault working tree remained clean after the baseline commit.


## [1.1.0] - 2026-09-01

Post-baseline stability and retrieval release.

### Added

- Safe setup wizard with read-only `--dry-run` mode.
- Duplicate detection before `memory_add`, with an explicit duplicate override.
- Optional project and repository scope for memories and searches.
- Automatic project context detection from `AGENT_PROJECT` or Git metadata.
- Optional provenance and freshness metadata.
- Local SQLite FTS5 cache backed by `better-sqlite3`.
- Hybrid search with a conservative fallback to live Notion search.
- Automatic cache refresh after a normal Notion synchronization.
- Cache invalidation after successful memory mutations.
- Expanded automated tests and GitHub Actions verification.

### Changed

- Node.js requirement is now 22 or newer for the FTS5 dependency.
- Documentation now describes installation, configuration, MCP tools, CLI usage, synchronization, cache behavior, security, and troubleshooting in one consistent language.

### Compatibility

- Existing Notion databases without optional `Project`, provenance, or freshness properties remain usable.
- Notion remains the source of truth; the SQLite cache and Obsidian mirror are derived data.
- Automatic search scoping is opt-in to preserve global-search behavior for existing clients.

## [1.0.0] - 2026-09-01

Initial stable baseline release. Tag `v1.0.0` points to commit `cf85836`.

### Added

- Shared Notion-backed memory MCP for AI coding agents.
- MCP tools for search, recent memories, read, create, update, and archive/delete.
- CLI fallback for memory operations.
- Optional Obsidian Markdown mirror with Git auto-sync.
- Agent attribution, categories, tags, importance, and archive status.
- Validation for memory titles and content.
- MIT license and public contribution/security documentation.

[Unreleased]: https://github.com/Chaerulcp/shared-agent-memory-mcp/compare/v1.6.1...HEAD
[1.6.1]: https://github.com/Chaerulcp/shared-agent-memory-mcp/releases/tag/v1.6.1
[1.6.0]: https://github.com/Chaerulcp/shared-agent-memory-mcp/releases/tag/v1.6.0
[1.5.0]: https://github.com/Chaerulcp/shared-agent-memory-mcp/releases/tag/v1.5.0
[1.4.0]: https://github.com/Chaerulcp/shared-agent-memory-mcp/releases/tag/v1.4.0
[1.3.1]: https://github.com/Chaerulcp/shared-agent-memory-mcp/releases/tag/v1.3.1
[1.3.0]: https://github.com/Chaerulcp/shared-agent-memory-mcp/releases/tag/v1.3.0
[1.2.3]: https://github.com/Chaerulcp/shared-agent-memory-mcp/releases/tag/v1.2.3
[1.2.2]: https://github.com/Chaerulcp/shared-agent-memory-mcp/releases/tag/v1.2.2
[1.2.1]: https://github.com/Chaerulcp/shared-agent-memory-mcp/releases/tag/v1.2.1
[1.2.0]: https://github.com/Chaerulcp/shared-agent-memory-mcp/releases/tag/v1.2.0
[1.1.2]: https://github.com/Chaerulcp/shared-agent-memory-mcp/releases/tag/v1.1.2
[1.1.1]: https://github.com/Chaerulcp/shared-agent-memory-mcp/releases/tag/v1.1.1
[1.1.0]: https://github.com/Chaerulcp/shared-agent-memory-mcp/releases/tag/v1.1.0
[1.0.0]: https://github.com/Chaerulcp/shared-agent-memory-mcp/releases/tag/v1.0.0
