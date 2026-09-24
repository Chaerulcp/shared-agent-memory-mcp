# Claude Code Integration Guide

**Complete setup instructions for integrating Shared Agent Memory MCP with Claude Code.**

📍 **Target Platform:** VS Code + Claude Code Extension  
⏱️ **Setup Time:** ~2 minutes  
✅ **Status:** Production Ready  

---

## 🎯 What You Get

When you integrate Agent Memory MCP with Claude Code, you enable:

- ✅ **Persistent Context** - Claude remembers decisions across sessions
- ✅ **Project Conventions** - Automatic enforcement of team standards  
- ✅ **Multi-Agent Collaboration** - Share memory between multiple AI assistants
- ✅ **Human-Auditable Decisions** - Review all memory entries in Notion or Obsidian
- ✅ **Smart Recall** - Get relevant project context automatically when needed

---

## 📋 Prerequisites

Before starting, ensure you have:

1. ✅ **VS Code** installed (latest version recommended)
2. ✅ **Claude Code extension** enabled in VS Code
3. ✅ **Node.js 22+** installed globally
4. ✅ **Notion integration token** (see [Setup Instructions](#getting-notion-integration-token))
5. ✅ **Agent Memory MCP Server** configured

### Installation Check

```bash
# Verify Node.js version
node --version
# Expected: v22.x or higher

# Verify Claude Code is available
code --list-extensions | grep claude-code
# Should show extension name if installed
```

---

## 🚀 Quick Setup (Copy-Paste Ready)

### Step 1: Install MCP Server

```bash
# Clone the repository
git clone https://github.com/Chaerulcp/shared-agent-memory-mcp.git
cd shared-agent-memory-mcp

# Install dependencies
npm install

# Build TypeScript
npm run build
```

### Step 2: Configure Environment Variables

Create a `.env` file in your working directory:

```env
NOTION_TOKEN=your_notion_token_here
NOTION_DATABASE_ID=your-database-id-here

# Optional settings
OBSIDIAN_VAULT_PATH=C:/Users/your-user/Documents/ObsidianVault
MEMORY_CACHE_PATH=C:/absolute/path/to/memory.sqlite
```

⚠️ **Important:** Never commit `.env` files to Git! The `.gitignore` protects them automatically.

### Step 3: Create MCP Configuration File

In your VS Code workspace root, create `claude-code.mcp.json`:

```jsonc
{
  "$schema": "https://json.schemastore.org/mcp-config",
  "mcpServers": {
    "agent-memory": {
      "command": "node",
      "args": ["C:/path/to/shared-agent-memory-mcp/dist/index.js"],
      "env": {
        "NOTION_TOKEN": "${NOTION_TOKEN}",
        "NOTION_DATABASE_ID": "${NOTION_DATABASE_ID}"
      }
    }
  }
}
```

**Customize:**
- Replace `C:/path/to/...` with your actual installation path
- Remove `${}` syntax if using direct tokens (not recommended for security)

### Step 4: Restart Claude Code

1. **Reload VS Code window**: Press `Ctrl+Shift+P` → Type "Reload Window"
2. **Verify MCP connection**: In terminal, run:
   ```bash
   node C:/path/to/shared-agent-memory-mcp/dist/cli.js doctor --sync
   ```
   
Expected output: `Overall: HEALTHY ✅`

---

## 🔧 Advanced Configuration

### Using Environment Variable Substitution

Instead of hardcoding tokens, use secure environment variables:

#### Windows PowerShell

```powershell
$env:NOTION_TOKEN = "secret_YourToken..."
$env:NOTION_DATABASE_ID = "abc123def456..."
```

Then in config JSON, reference them directly (MCP clients usually auto-resolve).

#### Unix/macOS

```bash
export NOTION_TOKEN="secret_YourToken..."
export NOTION_DATABASE_ID="abc123def456..."
```

### Multi-Dataset Support

For organizations managing multiple projects:

```json
{
  "$schema": "https://json.schemastore.org/mcp-config",
  "mcpServers": {
    "project-alpha-memory": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": { "NOTION_TOKEN": "...", "NOTION_DATABASE_ID": "alpha-db-id" },
      "cwd": "/path/to/project-alpha"
    },
    "project-beta-memory": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": { "NOTION_TOKEN": "...", "NOTION_DATABASE_ID": "beta-db-id" },
      "cwd": "/path/to/project-beta"
    }
  }
}
```

### Cache Configuration

Use `MEMORY_CACHE_PATH` when the MCP server and CLI must share one cache file. The value must be an absolute path. Run `node dist/cli.js cache rebuild` after changing it.

---

## 🎯 Usage Examples

### Access Memory in Claude Conversations

Once integrated, Claude can call the standard MCP memory tools directly through the configured server. Use prompts that tell Claude to search or save memories before making a decision.

```text
Search for prior decisions about authentication and API conventions for this project.
If a relevant memory exists, use it as context.
If a new decision is made, save it with memory_add and include the project and tags.
```

### Typical Memory Workflow

- Search with `memory_search` for the relevant topic and `project` value.
- Use `memory_get` for the full content of a specific result.
- Save new knowledge with `memory_add` when the decision should persist.
- Correct stale knowledge with `memory_update` rather than creating duplicates.

### Cache Configuration

Use `MEMORY_CACHE_PATH` when the MCP process and CLI must share a single cache file. The value must be an absolute path. Run `node dist/cli.js cache rebuild` after changing it.

---

## 🔍 Troubleshooting

### Issue: "Extension not loading MCP configuration"

**Symptoms:** Claude Code doesn't show up as active in VS Code status bar.

**Solution:**
```bash
# 1. Verify config file location
ls -la ./claude-code.mcp.json

# 2. Validate JSON syntax
cat ./claude-code.mcp.json | jq .

# 3. Check server health manually
node dist/cli.js doctor
```

### Issue: "Connection timeout after 30 seconds"

**Symptoms:** MCP server fails to start within default timeout.

**Solution:** Increase timeout in config:

```json
{
  "mcpServers": {
    "agent-memory": {
      "timeout": 60000, // Extended to 60 seconds
      "retries": 3,
      "backoff": 2.0
    }
  }
}
```

### Issue: "Access denied to database"

**Symptoms:** Error appears when trying to add/search memories.

**Solution:**
1. Open your Notion database
2. Click "Share" button
3. Find "Agent Memory System" integration
4. Grant **"Can edit"** permission (read-only is insufficient)
5. Wait 30 seconds for permissions to propagate
6. Run `node dist/cli.js doctor --sync` to verify

### Issue: "Cache returns no results"

**Symptoms:** Recent memories not showing up immediately.

**Solution:** Rebuild index:

```bash
node dist/cli.js cache rebuild
```

This forces a complete reindex of all stored memories.

---

## 📊 Performance Monitoring

Track memory system health regularly:

```bash
# Full diagnostic report
node dist/cli.js doctor --verbose

# Cache statistics
node dist/cli.js cache stats

# Sync status with Notion
node dist/cli.js sync --status

# Query performance metrics
node dist/cli.js benchmark --iterations 100
```

### Expected Benchmarks (v1.4.0)

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

❌ **DON'T** embed tokens directly in config JSON:
```json
// BAD - Exposes secrets
{
  "env": {
    "NOTION_TOKEN": "secret_xyz123..."
  }
}
```

✅ **DO** use environment variables or secret managers:
```json
// GOOD - Secrets externalized
{
  "env": {
    "NOTION_TOKEN": "${SECRET_NOTION_TOKEN}",
    "NOTION_DATABASE_ID": "${DB_ID}"
  }
}
```

### Repository Safety

- ✅ `.env` files excluded by `.gitignore`
- ✅ Tokens never logged (check logs to verify)
- ✅ Config files can include placeholders like `${TOKEN}`
- ✅ Use separate `.env.local` for development vs production

### Notion Permissions

Grant minimal required permissions:
- **Database Edit** for read/write operations
- **Page Read** for viewing existing memories
- Avoid admin-level access unless necessary

---

## 🤝 Getting Help

- **Quick Fixes:** See [Troubleshooting](#troubleshooting) section above
- **Detailed Guides:** See [`docs/integrations/README.md`](../README.md)
- **Live Discussions:** [GitHub Discussions](https://github.com/Chaerulcp/shared-agent-memory-mcp/discussions)
- **Bug Reports:** [GitHub Issues](https://github.com/Chaerulcp/shared-agent-memory-mcp/issues)

---

## 📞 Next Steps

After successful setup:

1. ✅ Test basic CRUD operations
2. ✅ Verify memory persistence across sessions  
3. ✅ Check search relevance with real project data
4. ✅ Monitor first-week usage patterns
5. ✅ Customize weights/ranking for your specific needs

**Want more?** Explore advanced topics in the [`GETTING_STARTED.md`](../../GETTING_STARTED.md) documentation.

---

**Copyright © 2026-present** - All rights reserved globally.

*Last reviewed: 2026-09-24 | Package version: 1.6.1*
