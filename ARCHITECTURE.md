# Architecture

## Data flow

```text
MCP-compatible agent / CLI
          |
          v
  shared-agent-memory-mcp
          |
          +--> Notion database (source of truth)
          |
          +--> Obsidian Markdown mirror
                         |
                         +--> Git commit + optional push
```

## Components

- `src/index.ts`: MCP stdio server and validated tool schemas.
- `src/store.ts`: Notion operations and synchronization orchestration.
- `src/obsidian.ts`: Markdown mirror, Git sync, and watcher lock.
- `src/cli.ts`: CLI fallback, doctor, sync, and watch commands.
- `src/config.ts`: local environment loading and Notion ID normalization.

## Consistency model

Notion is authoritative. Operations through MCP write Notion first, then update the Obsidian mirror. Direct Notion edits are imported by `sync` or `watch`. Direct Obsidian edits are not imported into Notion, preventing silent two-way conflicts.

## Failure behavior

- Missing Obsidian vault: Notion operations continue.
- Failed Git push: the local commit remains available for a later retry.
- Existing watcher: a lock prevents duplicate polling processes.
- Invalid tool input: Zod rejects it before storage.

## Security model

Credentials are read from process environment or a local `.env` file. They are not part of MCP tool arguments, Markdown frontmatter, Git commits, or logs.
