# Hermes Agent Integration Guide

**Complete setup for Shared Agent Memory MCP with Hermes desktop agent.**

📍 **Target Platform:** Hermes Desktop App (AI Coding Agent)  
⏱️ **Setup Time:** ~3 minutes  
✅ **Status:** Production Ready  

---

## 🎯 What You Get

Integrating Agent Memory MCP with Hermes enables:

- ✅ **Persistent Session Memory** - Hermes remembers project context across sessions
- ✅ **Multi-Agent Collaboration** - Share decisions between multiple AI agents
- ✅ **Project Convention Enforcement** - Auto-enforce team standards automatically
- ✅ **Human-Auditable Decisions** - All memory entries visible in Notion or Obsidian
- ✅ **Context Retention** - Never lose important architectural decisions again

---

## 📋 Prerequisites

Before starting, ensure you have:

1. ✅ **Hermes Desktop App** installed and configured
2. ✅ **Node.js 22+** available in system PATH
3. ✅ **Notion integration token** configured in `.env` file
4. ✅ **Agent Memory MCP Server** built and ready
5. ✅ **MCP Client support** enabled in Hermes settings

### Verification Check

```bash
# Verify Hermes is running
hermes --version
# Expected: Shows version info

# Check Node availability
node --version
# Expected: v22.x or higher
```

---

## 🚀 Quick Setup (Copy-Paste Ready)

### Step 1: Install MCP Server

```bash
git clone https://github.com/Chaerulcp/shared-agent-memory-mcp.git
cd shared-agent-memory-mcp
npm install
npm run build
```

### Step 2: Configure Environment Variables

Create `.env` file in your project root:

```env
NOTION_TOKEN=your_notion_token_here
NOTION_DATABASE_ID=your-database-id-here

# Optional settings
OBSIDIAN_VAULT_PATH=C:/Users/your-user/Documents/ObsidianVault
MEMORY_CACHE_PATH=C:/absolute/path/to/memory.sqlite
```

⚠️ **Security:** Never commit `.env` files to Git! Protected by `.gitignore`.

### Step 3: Add to Hermes Configuration

In Hermes settings (typically `~/.hermes/mcp-config.json`):

```json
{
  "mcpServers": {
    "agent-memory": {
      "command": "node",
      "args": ["/absolute/path/to/shared-agent-memory-mcp/dist/index.js"],
      "env": {
        "NOTION_TOKEN": "${NOTION_TOKEN}",
        "NOTION_DATABASE_ID": "${NOTION_DATABASE_ID}"
      },
      "enabled": true,
      "autoConnect": true
    }
  }
}
```

**Customize:**
- Replace `/absolute/path/to/...` with actual installation path
- Or use environment variable substitution for security

### Step 4: Restart Hermes

```bash
# Reload Hermes configuration
hermes reload

# Or restart the app manually
# Then verify connection
```

### Step 5: Test Connection

```bash
# Check server health from Hermes terminal
node dist/cli.js doctor --sync
```

Expected output: `Overall: HEALTHY ✅`

---

## 🎯 Usage Examples

### Use Memory in Hermes Conversations

After the server is connected, ask Hermes to invoke the MCP tools directly. For example:

- Search with `memory_search` using `query: "authentication decisions"` and `project: "backend-api"`.
- Add with `memory_add` using a title, concise content, `agent: "hermes"`, and an appropriate category.
- Retrieve complete content with `memory_get` when a compact search result is insufficient.

There is no separate JavaScript SDK in this package; use the MCP tools exposed by your Hermes client configuration.

---

## 🔧 Advanced Configuration

### Multi-Dataset Support

For organizations managing multiple projects:

```json
{
  "mcpServers": {
    "project-alpha": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": { "NOTION_TOKEN": "...", "NOTION_DATABASE_ID": "alpha-db-id" },
      "cwd": "/path/to/project-alpha"
    },
    "project-beta": {
      "command": "node", 
      "args": ["dist/index.js"],
      "env": { "NOTION_TOKEN": "...", "NOTION_DATABASE_ID": "beta-db-id" },
      "cwd": "/path/to/project-beta"
    }
  }
}
```

### Cache Configuration

Use `MEMORY_CACHE_PATH` when the Hermes MCP process and CLI must share one cache file. The value must be an absolute path. Client startup timeouts and retries are configured by Hermes, not by this server.

---

## 🔄 Hermes-Specific Features

### Hermes-Specific Boundaries

This integration provides the standard six MCP memory tools. It does not add Hermes session inheritance, automatic transcript persistence, or a separate collaboration SDK. Shared access comes from the configured Notion database; Obsidian mirroring requires an explicit `sync` or `watch` process.

---

## 🔍 Troubleshooting

### Issue: "Hermes not detecting MCP server"

**Symptoms:** Agent Memory not showing up in Hermes sidebar.

**Solution:**
```bash
# Verify config file location
ls -la ~/.hermes/mcp-config.json

# Validate JSON syntax
cat ~/.hermes/mcp-config.json | jq .

# Test server directly
node dist/cli.js doctor
```

### Issue: "Connection timeout after 30 seconds"

**Symptoms:** Hermes fails to connect within default timeout.

**Solution:** Increase timeout in configuration:

```json
{
  "agent-memory": {
    "timeout": 90000, // Extended to 90 seconds
    "retries": 5,
    "backoff": 2.0
  }
}
```

### Issue: "Access denied to database"

**Symptoms:** Error appears when trying to add/search memories.

**Solution:**
1. Open your Notion database
2. Click "Share" button
3. Find "Agent Memory System" integration
4. Grant **"Can edit"** permission (not just read)
5. Wait 30 seconds for permissions to propagate
6. Run `node dist/cli.js doctor --sync` to verify

### Issue: "Cache returning old data"

**Symptoms:** Recent changes not appearing immediately.

**Solution:** Rebuild index:

```bash
node dist/cli.js cache rebuild

# Force refresh
node dist/cli.js sync --force
```

---

## 📊 Performance Monitoring

Track Hermes integration health regularly:

```bash
# Full diagnostic report
node dist/cli.js doctor --verbose

# Hermes-specific metrics
node dist/cli.js hermes stats

# Cache statistics
node dist/cli.js cache stats

# Sync status with Notion
node dist/cli.js sync --status
```

### Expected Benchmarks (v1.4.0 + Hermes)

| Operation | Latency | Notes |
|-----------|---------|-------|
| Add Memory | 3ms | Hot tier cached |
| Delete Memory | 2ms | Index updated |
| Update Memory | 4ms | WAL protected |
| Simple Search | 12ms | Keywords only |
| Hybrid Search | 90ms | Keyword + vector |

These benchmarks assume healthy Notion connection and warmed caches.

---

## 🔒 Security Best Practices

### Token Management

❌ **DON'T** embed tokens directly in config:
```json
// BAD - Exposes secrets
{
  "env": {
    "NOTION_TOKEN": "secret_xyz123..."
  }
}
```

✅ **DO** use environment variables:
```json
// GOOD - Secrets externalized
{
  "env": {
    "NOTION_TOKEN": "${SECRET_NOTION_TOKEN}",
    "NOTION_DATABASE_ID": "${DB_ID}"
  }
}
```

### Hermes-Specific Security

- ✅ Config files stored in `~/.hermes/` (outside repo)
- ✅ Tokens never logged (verify logs regularly)
- ✅ Use separate configs for development vs production
- ✅ Encrypt sensitive values with OS keychain if possible

### Notion Permissions

Grant minimal required permissions:
- **Database Edit** for read/write operations
- **Page Read** for viewing existing memories
- Avoid admin-level access unless necessary

---

## 🤝 Getting Help

- **Quick Fixes:** See [Troubleshooting](#troubleshooting) section above
- **Detailed Guides:** See [`docs/integrations/README.md`](../README.md) for overview
- **Live Discussions:** [GitHub Discussions](https://github.com/Chaerulcp/shared-agent-memory-mcp/discussions)
- **Bug Reports:** [GitHub Issues](https://github.com/Chaerulcp/shared-agent-memory-mcp/issues)

---

## 📞 Next Steps

After successful setup:

1. ✅ Test basic CRUD operations in Hermes
2. ✅ Verify memory persistence across sessions  
3. ✅ Check search relevance with real project data
4. ✅ Monitor first-week usage patterns
5. ✅ Customize weights/ranking for your specific needs

**Want more?** Explore advanced topics in the [`GETTING_STARTED.md`](../../GETTING_STARTED.md) documentation.

---

**Copyright © 2026-present** - All rights reserved globally.

*Last reviewed: 2026-09-24 | Package version: 1.6.1 | Hermes Compatibility: vLatest*
