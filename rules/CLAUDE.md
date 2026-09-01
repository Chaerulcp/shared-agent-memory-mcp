# Shared Agent Memory (Notion) — for Claude Code

This project uses a **shared long-term memory stored in Notion**, accessible through the MCP
server `notion-memory` (same memory as Cline, OpenCode, GitHub Copilot, Hermes).

Tools: `memory_search`, `memory_recent`, `memory_get`, `memory_add`, `memory_update`, `memory_delete`.
CLI fallback: `node C:/path/to/shared-agent-memory-mcp/dist/cli.js search|add|get|update|delete ...`

## READ memory before you work
1. At task start, run `memory_search` with keywords from the task (feature, error message, technology).
2. Optionally run `memory_recent` (limit 5).
3. Apply saved preferences/conventions/decisions — never re-ask what is already saved.

## WRITE memory when knowledge is durable
Run `memory_add` when the user states a preference, a project decision is made, a convention is
established, a non-obvious bug is fixed (root cause + fix), or important environment knowledge
is learned. Never store secrets/tokens.

## Writing rules
- title: short, imperative, searchable (≤ 80 chars)
- content: 1–5 sentences, enough context to be useful later
- agent: `claude-code` (or `shared` for universal rules)
- category: preference | decision | convention | context | bugfix | task | other
- importance: high | medium | low
- Prefer updating existing memories over duplicates; correct wrong memories immediately.
