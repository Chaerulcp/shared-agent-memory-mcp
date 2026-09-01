# Shared Agent Memory (Notion) — for GitHub Copilot

This repository uses a shared long-term memory stored in Notion, exposed through the MCP server
`notion-memory` (agent mode). The same memory is shared with Cline, Claude Code, OpenCode, Hermes.

Tools: `memory_search`, `memory_recent`, `memory_get`, `memory_add`, `memory_update`, `memory_delete`.
CLI fallback: `node C:/path/to/shared-agent-memory-mcp/dist/cli.js search|add|get|update|delete`

## READ memory before you work
1. At task start, call `memory_search` with keywords from the task (feature, error, technology).
2. Optionally call `memory_recent` (limit 5).
3. Apply any saved preferences, conventions, or decisions.

## WRITE memory when knowledge is durable
Call `memory_add` when: the user states a preference, a project decision is made, a convention is
established, a non-obvious bug is fixed (root cause + fix), or environment knowledge is learned.
Never store secrets/tokens.

## Writing rules
- title: short, imperative, searchable (≤ 80 chars)
- content: 1–5 sentences with enough context for later reuse
- agent: `copilot` (or `shared` for universal rules)
- category: preference | decision | convention | context | bugfix | task | other
- importance: high | medium | low
- Prefer updating existing memories over duplicates.
