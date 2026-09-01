# Changelog

All notable changes to this project are documented here.

The project follows Semantic Versioning. The `v1.1.0` release includes the post-baseline reliability, retrieval, setup, and project-context improvements.

## [Unreleased]

No unreleased changes.

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

[Unreleased]: https://github.com/Chaerulcp/shared-agent-memory-mcp/compare/v1.1.1...HEAD
[1.1.1]: https://github.com/Chaerulcp/shared-agent-memory-mcp/releases/tag/v1.1.1

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

[Unreleased]: https://github.com/Chaerulcp/shared-agent-memory-mcp/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Chaerulcp/shared-agent-memory-mcp/releases/tag/v1.0.0
