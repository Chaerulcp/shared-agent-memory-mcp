# Gemini CLI Integration

Use Shared Agent Memory MCP from Gemini CLI through its MCP server configuration.

**Status:** Configuration template verified against a local Gemini/Antigravity MCP configuration; end-to-end Gemini CLI session not independently tested in this repository.
**Setup time:** About 5 minutes

## Prerequisites

- Gemini CLI with MCP server support enabled
- Node.js 22 or newer
- A built checkout of this repository
- A Notion integration token and database ID

Build the server:

```bash
npm ci
npm run build
```

## Configuration

Add this entry to the MCP configuration used by Gemini CLI. Use an absolute path to your checkout.

```json
{
  "mcpServers": {
    "shared-agent-memory": {
      "command": "node",
      "args": ["C:/path/to/shared-agent-memory-mcp/dist/index.js"],
      "env": {
        "NOTION_TOKEN": "your_notion_token_here",
        "NOTION_DATABASE_ID": "your_notion_database_id_here"
      }
    }
  }
}
```

Do not commit real tokens or database credentials. Keep local configuration outside Git or in an ignored file.

## Verify

1. Restart Gemini CLI after changing its MCP configuration.
2. Confirm `shared-agent-memory` is listed as an available MCP server.
3. Save and search a harmless test memory.
4. Remove the test memory after verification.

If startup fails, run:

```bash
node dist/cli.js doctor
```

See the [integration overview](./README.md) and [getting started guide](../../GETTING_STARTED.md).

**License:** MIT
