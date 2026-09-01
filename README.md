# Shared Agent Memory MCP

Shared long-term memory for AI coding agents, backed by Notion with optional Obsidian Vault dual-write.

This project exposes a Model Context Protocol (MCP) server and a CLI for storing durable project decisions, conventions, environment notes, and bug fixes. It is designed to work with Cline, OpenCode, Claude Code, GitHub Copilot, Gemini CLI, Hermes, and other MCP-compatible clients.

## Features

- MCP stdio server with `memory_search`, `memory_recent`, `memory_get`, `memory_add`, `memory_update`, and `memory_delete`
- CLI fallback for agents without MCP support
- Notion database storage
- Optional fire-and-forget Obsidian Vault dual-write
- Agent attribution, categories, tags, importance, and archive status
- Explicit validation for memory titles and content
- No credentials committed to the repository

## Requirements

- Node.js 18 or newer
- A Notion integration and a database shared with that integration
- Optional: an Obsidian Vault initialized as a Git repository for dual-write sync

## Installation

```powershell
git clone https://github.com/Chaerulcp/shared-agent-memory-mcp.git
cd shared-agent-memory-mcp
npm install
npm run build
```

Copy `.env.example` to `.env` and set:

```dotenv
NOTION_TOKEN=secret_your_token_here
NOTION_DATABASE_ID=your_database_id_here
```

Never commit `.env`.

## Notion setup

1. Create an integration at https://www.notion.so/profile/integrations.
2. Create a Notion page/database for agent memory.
3. Share the database with the integration.
4. Set `NOTION_TOKEN` and `NOTION_DATABASE_ID` in `.env`.
5. Run:

```powershell
npm run doctor
```

The database should contain the properties `Name`, `Content`, `Agent`, `Category`, `Tags`, `Importance`, `Status`, `Created`, and `Updated`.

## MCP client configuration

Build the project first, then use an absolute path to `dist/index.js` in your MCP client configuration. Examples for each client are available in `agents/`. Replace the placeholder path and provide credentials through the client environment or a secure secret store.

Example stdio registration:

```json
{
  "mcpServers": {
    "notion-memory": {
      "transport": {
        "type": "stdio",
        "command": "node",
        "args": ["C:/path/to/shared-agent-memory-mcp/dist/index.js"]
      }
    }
  }
}
```

Restart the client after changing MCP configuration; most clients do not hot-reload MCP tools.

## CLI

```powershell
node dist/cli.js doctor
node dist/cli.js search "laravel"
node dist/cli.js recent --limit 5
node dist/cli.js add --title "Use plan before implementation" --content "Review a plan before editing project files." --agent shared --category convention --importance high
node dist/cli.js get <id>
node dist/cli.js update <id> --status archived
node dist/cli.js delete <id>
```

## Obsidian dual-write

Set `OBSIDIAN_VAULT_PATH` to a Git-backed Obsidian Vault path. If the folder does not exist, the server continues in Notion-only mode. Manual edits in Obsidian do not automatically update Notion.

## Security

- Keep `.env` outside version control.
- Do not save API keys, tokens, passwords, or other secrets in memory.
- Use the minimum Notion page access required by the integration.
- Review every memory before sharing a public repository or issue.

## Development

```powershell
npm run build
npm run doctor
```

Contributions should include tests or a reproducible verification step for behavior changes.

## License

MIT. See [LICENSE](LICENSE).
