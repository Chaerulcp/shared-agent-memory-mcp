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
CACHE_TTL_MS=300000
CONCURRENT_THREADS=4
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
      "args": ["dist/index.js", "--database", "alpha-db-id"],
      "cwd": "/path/to/project-alpha"
    },
    "project-beta-memory": {
      "command": "node",
      "args": ["dist/index.js", "--database", "beta-db-id"],
      "cwd": "/path/to/project-beta"
    }
  }
}
```

### Performance Tuning

Adjust for high-performance workloads:

```json
{
  "mcpServers": {
    "agent-memory": {
      "command": "node",
      "args": [
        "dist/index.js",
        "--threads", "8",
        "--cache-size", "200",
        "--ttl", "600000"
      ],
      "env": { ... }
    }
  }
}
```

Flags explained:
- `--threads`: Parallel worker count (default: 4)
- `--cache-size`: LRU cache max items (default: 100)
- `--ttl`: Cache TTL in milliseconds (default: 300000)

---

## 🎯 Usage Examples

### Access Memory in Claude Conversations

Once integrated, Claude automatically has access to memory tools:

```typescript
// Natural language queries work seamlessly
const result = await ClaudeClient.ask({
  query: "What were our decisions about React authentication last sprint?",
  useMemory: true, // Auto-enables memory retrieval
  limit: 5
});
```

### Add New Memories Programmatically

```typescript
import { memoryPool } from '@chaerulcp/agent-memory-mcp';

await memoryPool.add({
  title: 'React 19 Migration Decision',
  content: 'Team decided to migrate to React 19 with concurrent features.',
  metadata: {
    projectId: 'frontend-app',
    importance: 'high',
    tags: ['react', 'migration', 'decision']
  }
});
```

### Search and Retrieve Context

```typescript
const context = await ClaudeClient.searchContext({
  query: 'authentication error handling patterns',
  filter: {
    category: 'convention',
    projectId: 'backend-api'
  },
  topK: 3
});

// Results automatically injected into conversation
```

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

*Last Updated: 2026-09-03 | Version: 1.4.0*
