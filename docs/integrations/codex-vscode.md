# Codex VSCode Extension Integration Guide

**Complete setup for Shared Agent Memory MCP with Codex VSCode Extension.**

📍 **Target Platform:** Codex VSCode AI Coding Extension  
⏱️ **Setup Time:** ~2 minutes  
✅ **Status:** Production Ready  

---

## 🎯 What You Get

Integrating Agent Memory MCP with Codex VSCode enables:

- ✅ **Persistent Context Across Sessions** - Codex remembers project decisions
- ✅ **Smart Code Generation** - AI generates code aligned with your team's patterns
- ✅ **Decision History Tracking** - All architectural decisions stored and retrievable
- ✅ **Multi-Agent Collaboration** - Share memories between multiple Codex instances
- ✅ **Human-Auditable AI Output** - Review and understand why Codex makes certain suggestions

---

## 📋 Prerequisites

Before starting, ensure you have:

1. ✅ **VSCode** installed (latest stable version)
2. ✅ **Codex VSCode Extension** installed and configured
3. ✅ **Node.js 22+** available in system PATH
4. ✅ **Notion integration token** ready
5. ✅ **Agent Memory MCP Server** built

### Installation Verification

```bash
# Verify Node.js version
node --version
# Expected: v22.x or higher

# Check VSCode extensions
code --list-extensions | grep codex
# Should show codex extension name
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

Create `.env` file in your workspace root:

```env
NOTION_TOKEN=your_notion_token_here
NOTION_DATABASE_ID=your-database-id-here
```

⚠️ **Security:** Never commit `.env` files to Git! Protected by `.gitignore`.

### Step 3: Create MCP Configuration

In your VSCode settings (`~/.vscode/userdata/User/settings.json`), add:

```json
{
  "mcpServers": {
    "agent-memory-codex": {
      "command": "node",
      "args": ["/absolute/path/to/shared-agent-memory-mcp/dist/index.js"],
      "env": {
        "NOTION_TOKEN": "${NOTION_TOKEN}",
        "NOTION_DATABASE_ID": "${NOTION_DATABASE_ID}"
      },
      "enabled": true
    }
  }
}
```

Replace `/absolute/path/to/...` with actual installation path.

### Step 4: Restart VSCode

```bash
# Reload VSCode window
# Press Ctrl+Shift+P → Type "Reload Window"
```

### Step 5: Test Connection

```bash
# Verify server health from terminal
node dist/cli.js doctor --sync
```

Expected output: `Overall: HEALTHY ✅`

---

## 🎯 Usage Examples

### Query Memory During Coding

```typescript
// In Codex chat interface within VSCode
const context = await CodexClient.queryMemory({
  query: "What authentication patterns should I use here?",
  limit: 5,
  currentFile: 'src/auth/login.tsx'
});
```

### Add Development Decisions

```typescript
import { memoryPool } from '@chaerulcp/agent-memory-mcp';

await memoryPool.add({
  title: 'Error Handling Pattern',
  content: 'Using custom Error classes with cause chaining for better debugging.',
  metadata: {
    projectId: 'frontend-app',
    importance: 'medium',
    tags: ['error-handling', 'best-practice'],
    createdBy: 'codex-extension'
  }
});
```

### Smart Code Generation Context

```typescript
// Automatic context injection during code generation
const relevantContext = await CodexClient.getContextForGeneration({
  targetFile: 'api/routes/users.ts',
  existingPatterns: ['error-handler', 'auth-middleware'],
  topK: 10
});
```

---

## 🔧 Advanced Configuration

### Multi-Workspace Support

For teams managing multiple projects:

```json
{
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

Optimize for large codebases:

```json
{
  "agent-memory-codex": {
    "threads": 8,
    "cacheSize": 500,
    "ttl": 600000,
    "timeout": 60000
  }
}
```

Flags explained:
- `--threads`: Parallel worker count (default: 4)
- `--cache-size`: LRU cache max items (default: 100, increase for large repos)
- `--ttl`: Cache TTL in milliseconds (default: 300000)
- `--timeout`: Connection timeout (default: 30s)

### Workspace-Specific Settings

Configure per-workspace (place in `.vscode/settings.json`):

```json
{
  "mcpServers.agent-memory-codex.args": [
    "dist/index.js",
    "--workspace", "${workspaceFolder}",
    "--database", "project-specific-db"
  ]
}
```

---

## 🔄 VSCode-Specific Features

### Live Context Updates

Real-time memory updates as you type:

```typescript
// Enable live context monitoring
await CodexClient.enableLiveContext({
  watchFiles: true,
  updateInterval: 5000, // Every 5 seconds
  relevanceThreshold: 0.7
});
```

### Memory-Based Suggestions

Get smarter code suggestions based on history:

```typescript
// Enhance suggestions with memory context
await CodexClient.enhanceSuggestions({
  memoryEnabled: true,
  prioritizeRecent: true,
  filterByProject: true
});
```

### Collaborative Coding

Share memory across team members' Codex instances:

```typescript
// Enable collaborative mode
await CodexClient.enableCollaboration({
  syncEnabled: true,
  conflictResolution: 'merge',
  broadcastDecisions: true
});
```

---

## 🔍 Troubleshooting

### Issue: "Extension not loading MCP configuration"

**Symptoms:** Codex doesn't show memory features.

**Solution:**
```bash
# Verify config in VSCode settings
code --status | grep mcp

# Validate JSON syntax
cat ~/.vscode/userdata/User/settings.json | jq .

# Test server directly
node dist/cli.js doctor
```

### Issue: "Connection timeout after 30 seconds"

**Symptoms:** VSCode fails to connect to MCP server.

**Solution:** Increase timeout:

```json
{
  "agent-memory-codex": {
    "timeout": 90000, // Extended to 90 seconds
    "retries": 5,
    "backoff": 2.0
  }
}
```

### Issue: "Access denied to database"

**Symptoms:** Memory operations fail with permission errors.

**Solution:**
1. Open your Notion database
2. Click "Share" button
3. Find "Agent Memory System" integration
4. Grant **"Can edit"** permission
5. Wait 30 seconds for permissions to propagate
6. Run `node dist/cli.js doctor --sync` to verify

### Issue: "Suggestions not showing memory context"

**Symptoms:** Codex suggestions don't reference stored decisions.

**Solution:**
```bash
# Rebuild index
node dist/cli.js cache rebuild

# Force reload context
node dist/cli.js sync --force

# Restart Codex extension
# Go to Extensions → Codex → Restart Extension
```

---

## 📊 Performance Monitoring

Track VSCode integration health regularly:

```bash
# Full diagnostic report
node dist/cli.js doctor --verbose

# VSCode-specific metrics
node dist/cli.js vscode stats

# Cache statistics
node dist/cli.js cache stats

# Sync status with Notion
node dist/cli.js sync --status
```

### Expected Benchmarks (v1.4.0 + Codex VSCode)

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

❌ **DON'T** embed tokens in VSCode settings:
```json
// BAD - Exposes secrets in user settings
{
  "mcpServers": {
    "agent-memory-codex": {
      "env": {
        "NOTION_TOKEN": "secret_xyz123..."
      }
    }
  }
}
```

✅ **DO** use environment variables:
```json
// GOOD - Secrets externalized
{
  "mcpServers": {
    "agent-memory-codex": {
      "env": {
        "NOTION_TOKEN": "${SECRET_NOTION_TOKEN}",
        "NOTION_DATABASE_ID": "${DB_ID}"
      }
    }
  }
}
```

### VSCode-Specific Security

- ✅ User settings stored outside repo
- ✅ Tokens never logged (check Developer Tools)
- ✅ Use separate settings for dev vs production
- ✅ Enable OS-level credential management when available

### Notion Permissions

Grant minimal required permissions:
- **Database Edit** for read/write operations
- **Page Read** for viewing existing memories
- Avoid admin-level access unless necessary

---

## 🤝 Getting Help

- **Quick Fixes:** See [Troubleshooting](#troubleshooting) section above
- **Detailed Guides:** [`docs/integrations/README.md`](../README.md) for overview
- **Live Discussions:** [GitHub Discussions](https://github.com/Chaerulcp/shared-agent-memory-mcp/discussions)
- **Bug Reports:** [GitHub Issues](https://github.com/Chaerulcp/shared-agent-memory-mcp/issues)

---

## 📞 Next Steps

After successful setup:

1. ✅ Test basic CRUD operations in Codex
2. ✅ Verify memory persistence across VSCode sessions  
3. ✅ Check suggestion quality with memory context
4. ✅ Monitor first-week usage patterns
5. ✅ Customize weights/ranking for your specific needs

**Want more?** Explore advanced topics in the [`GETTING_STARTED.md`](../../GETTING_STARTED.md) documentation.

---

**Copyright © 2026-present** - All rights reserved globally.

*Last Updated: 2026-09-03 | Version: 1.4.0 | Codex VSCode Compatibility: Latest*
