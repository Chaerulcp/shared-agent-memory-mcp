# Shared Agent Memory (Notion)

This project uses a **shared long-term memory stored in Notion**, accessible from every agent
(Cline, OpenCode, Claude Code, GitHub Copilot, Hermes) through the MCP server `notion-memory`.

## Available tools (MCP)

- `memory_search(query, agent?, category?, tag?, limit?)` — find memories by keywords
- `memory_recent(limit?, agent?)` — latest saved memories
- `memory_get(id)` — full detail of one memory
- `memory_add(title, content, agent, category?, tags?, importance?)` — save new memory
- `memory_update(id, ...)` — fix/refresh an existing memory
- `memory_delete(id)` — archive a memory

If the MCP tools are unavailable, use the CLI instead:
`node C:/path/to/shared-agent-memory-mcp/dist/cli.js` with `search`, `recent`, `add`, `get`, `update`, `delete`.

## READ memory before you work

At the start of a task:

1. `memory_search` with keywords from the current task (feature names, error messages, technologies).
2. Optionally `memory_recent` (limit 5) for fresh context.
3. Apply any preferences, conventions, or decisions you find — do not re-ask things already saved.

## WRITE memory when knowledge is durable

Call `memory_add` when:

- The user states a preference ("always use pnpm", "jawab dalam Bahasa Indonesia", styling rules).
- A project decision is made (architecture, library choice, naming, deployment target).
- A non-obvious bug is found and fixed (save root cause + the fix).
- Important environment/setup knowledge is learned (where things live, credentials location, how to run/deploy).
- A recurring convention is established.

Do **NOT** save: secrets/tokens/passwords, temporary chat, trivial or one-off facts.

Memories are dual-written automatically: Notion (primary) + Obsidian vault
(`C:/path/to/your/ObsidianVault/memories/<category>/*.md`, synced to GitHub
private repo Chaerulcp/obsidian-vault). If the Notion MCP is unreachable, the vault's
Markdown files can be read directly as a fallback knowledge source. Manual edits in the
vault do NOT flow back to Notion — use memory_update via the tools to keep both in sync.

## Writing rules

- `title`: short, imperative, searchable (≤ 80 chars).
- `content`: 1–5 sentences with enough context to be useful later; include short examples when helpful.
- `agent`: your own name (`cline` | `opencode` | `claude-code` | `copilot` | `hermes`), or `shared` for universal rules.
- `category`: `preference` | `decision` | `convention` | `context` | `bugfix` | `task` | `other`.
- `importance`: `high` = work breaks without it, `medium` = useful, `low` = nice to have.
- Prefer `memory_update` on an existing memory over creating duplicates.
- If a memory turns out to be wrong, correct or archive it immediately.
