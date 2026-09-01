# Shared Agent Memory MCP

Shared long-term memory for AI coding agents, backed by Notion with optional Obsidian Vault dual-write.

This project exposes a Model Context Protocol (MCP) server and a CLI for storing durable project decisions, conventions, environment notes, and bug fixes. It is designed to work with Cline, OpenCode, Claude Code, GitHub Copilot, Gemini CLI, Hermes, and other MCP-compatible clients.

## Features

- MCP stdio server with `memory_search`, `memory_recent`, `memory_get`, `memory_add`, `memory_update`, and `memory_delete`
- CLI fallback for agents without MCP support
- Notion database storage
- Optional fire-and-forget Obsidian Vault dual-write
- Agent attribution, categories, tags, importance, project scope, and archive status
- Duplicate detection before `memory_add`, with explicit override when needed
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

### Project scope and duplicate protection

`memory_add` accepts an optional `project` value, such as a repository name or stable project identifier. `memory_search` accepts the same value to limit results to that project. The `Project` property is added automatically to databases created by this project; existing databases without that property remain compatible.

Before saving, the server compares the new title and content with active memories in the same project. If a likely duplicate is found, it returns the matching candidates instead of creating another page. Prefer `memory_update` using the candidate ID. Set `allowDuplicate: true` only when the new memory is intentionally separate.

Example:

```json
{
  "title": "Use Laravel 12",
  "content": "The CRM project uses Laravel 12 and Vite.",
  "agent": "shared",
  "category": "convention",
  "project": "crm",
  "allowDuplicate": false
}
```

## Obsidian integration and automatic sync

There are two supported flows:

1. Agent/MCP flow: `memory_add`, `memory_update`, and `memory_delete` write Notion and then update Obsidian, commit, and push.
2. Notion-first flow: if you edit a memory directly in Notion, run `sync` or keep `watch` running. Notion has no webhook in this local MCP, so an idle MCP process cannot detect a direct Notion edit by itself.

Set the vault path in `.env`:

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
npm run build
npm run sync
```

Run continuous polling every five minutes (minimum 30 seconds):

```powershell
npm run watch
```

Each polling cycle queries Notion, rewrites the corresponding Markdown files, runs `git add`, creates a commit only when files changed, and attempts `git push`. A failed push does not lose the local commit.

For Windows auto-start, create a Task Scheduler task that launches a PowerShell action such as:

```powershell
Start-Process -FilePath node -ArgumentList 'C:/path/to/shared-agent-memory-mcp/dist/cli.js','watch','--interval','300' -WorkingDirectory 'C:/path/to/shared-agent-memory-mcp' -WindowStyle Hidden
```

Use a process manager or Task Scheduler restart-on-failure policy for production-like reliability. Do not put Notion credentials in the command line; use `.env` or the MCP client's secure environment settings.

Manual edits in Obsidian are not imported back into Notion. Notion remains the source of truth for this one-way synchronization design.

## Security

- Keep `.env` outside version control.
- Do not save API keys, tokens, passwords, or other secrets in memory.
- Use the minimum Notion page access required by the integration.
- Review every memory before sharing a public repository or issue.

## Setup wizard

After cloning, run the read-only setup check:

```powershell
npm install
npm run build
npm run setup -- --dry-run
```

Run `npm run setup` to verify the local project, `.env`, Notion database, Obsidian vault, and Git remote. The command never prints credential values. It does not create a Notion database or modify agent configuration. To create a new Notion database, use the separate command:

```powershell
npm run init-db -- https://www.notion.so/your-parent-page
```

The setup wizard returns exit code `0` when all checks pass and `1` when action is required.

## Development

```powershell
npm run build
npm test
npm run doctor
```

## Releases

This project follows Semantic Versioning. See [CHANGELOG.md](CHANGELOG.md) for release history. Do not commit local `.env` files or generated `dist/` output.

## Support and security

See [SECURITY.md](SECURITY.md) for vulnerability reporting and credential handling.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for data flow and consistency guarantees.

## Development

```powershell
npm run build
npm run doctor
```

Contributions should include tests or a reproducible verification step for behavior changes.

## License

MIT. See [LICENSE](LICENSE).
