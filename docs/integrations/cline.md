# Cline Integration

Use Shared Agent Memory MCP from Cline through its stdio MCP configuration.

**Status:** Configuration template verified; end-to-end Cline session not independently tested in this repository.
**Setup time:** About 5 minutes

## Prerequisites

- Node.js 22 or newer
- A built checkout of this repository
- A Notion integration token and database ID

Build the server first:

```bash
npm ci
npm run build
```

## Configuration

Open Cline's MCP settings and add this server. Replace the placeholders with your own values and use an absolute path to your checkout.

```json
{
  "mcpServers": {
    "shared-agent-memory": {
      "type": "stdio",
      "command": "node",
      "args": ["C:/path/to/shared-agent-memory-mcp/dist/index.js"],
      "env": {
        "NOTION_TOKEN": "your_notion_token_here",
        "NOTION_DATABASE_ID": "your_notion_database_id_here"
      },
      "disabled": false,
      "alwaysAllow": false
    }
  }
}
```

Do not commit this configuration when it contains real credentials. Keep secrets in the client environment or a local, ignored configuration file.

## Verify in Cline

1. Restart or reload Cline after saving the MCP configuration.
2. Confirm that `shared-agent-memory` appears as an available MCP server.
3. Ask Cline to save a harmless test memory.
4. Ask it to search for that memory.
5. Remove the test memory after verification.

If the server does not start, run locally:

```bash
node dist/cli.js doctor
```

See the [integration overview](./README.md) and [contributing guide](../../CONTRIBUTING.md) for more information.

**License:** MIT
