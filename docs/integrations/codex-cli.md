# Codex CLI Integration Guide

**Complete setup for Shared Agent Memory MCP with Codex Command Line Interface.**

📍 **Target Platform:** Codex CLI (Command Line AI Coding Assistant)  
⏱️ **Setup Time:** ~3 minutes  
✅ **Status:** Production Ready  

---

## 🎯 What You Get

Integrating Agent Memory MCP with Codex CLI enables:

- ✅ **Terminal Session Persistence** - Context survives across terminal sessions
- ✅ **Long-Running Task Memory** - Remember decisions across hours/days of development
- ✅ **Project Convention Enforcement** - Auto-enforce team standards in CLI workflows
- ✅ **Command History Awareness** - Learn from past CLI patterns and decisions
- ✅ **Cross-Shell Integration** - Works seamlessly with bash, zsh, PowerShell, etc.

---

## 📋 Prerequisites

Before starting, ensure you have:

1. ✅ **Codex CLI** installed (v2026+)
2. ✅ **Node.js 22+** available in system PATH
3. ✅ **Notion integration token** configured
4. ✅ **Agent Memory MCP Server** built and ready
5. ✅ **Terminal shell** configured (bash/zsh/powershell)

### Verification Check

```bash
# Verify Codex CLI is installed
codex --version
# Expected: Shows version info

# Check Node availability
node --version
# Expected: v22.x or higher
```

---

## 🚀 Quick Setup

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
```

### Step 3: Add to Codex CLI Configuration

In `~/.codex/mcp-config.json`:

```json
{
  "mcpServers": {
    "agent-memory-cli": {
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

### Step 4: Reload Codex CLI

```bash
# Reload CLI configuration
codex reload mcp

# Or restart terminal session
```

### Step 5: Test Connection

```bash
# Verify server health
node dist/cli.js doctor --sync
```

Expected output: `Overall: HEALTHY ✅`

---

## 🎯 Usage Examples

### Query Memory in Terminal Sessions

```bash
# Ask Codex with memory context
codex ask "What authentication patterns did we implement last sprint?" \
  --memory-enabled \
  --limit 5
```

### Record Architectural Decisions

```bash
# Log important decision
codex memory add \
  --title "Database Schema Decision" \
  --content "Using PostgreSQL with JSONB fields for flexible attributes." \
  --project payment-service \
  --importance high \
  --category architecture
```

### Search Recent Changes

```bash
# Find all cache-related decisions
codex memory search cache \
  --filter project:payment-service \
  --limit 10
```

### Command History Integration

```bash
# Ask about patterns in command history
codex ask "Based on my recent commands, what database patterns should I follow?" \
  --include-history \
  --topK 10
```

---

## 🔧 Advanced Configuration

### Multi-Dataset Support

Manage multiple projects:

```json
{
  "servers": {
    "project-alpha": {
      "databaseId": "db-alpha-id",
      "contextPrefix": "alpha-",
      "cwd": "/path/to/project-alpha"
    },
    "project-beta": {
      "databaseId": "db-beta-id",
      "contextPrefix": "beta-",
      "cwd": "/path/to/project-beta"
    }
  }
}
```

### Shell Integration Hooks

Add to your shell config (`~/.bashrc`, `~/.zshrc`, or `~/.powershell/profile.ps1`):

#### Bash/zsh:

```bash
# Source MCP environment on each new shell
if [ -f ~/.codex/mcp-env.sh ]; then
    source ~/.codex/mcp-env.sh
fi

# Pre-command hook for memory logging
precmd() {
    codex memory log-command "$CMD" 2>/dev/null || true
}
```

#### PowerShell:

```powershell
# Load MCP environment on startup
if (Test-Path "~/.codex/mcp-env.ps1") {
    . "~/.codex/mcp-env.ps1"
}

# Register pre-execution hook for memory tracking
$PROFILE = "$HOME\Documents\WindowsPowerShell\Profile.ps1"
Add-Content $PROFILE @"
before: {
    codex memory log-command `\$MyInvocation.Line 2>$null` || \$true
}
"@
```

### Performance Tuning

Optimize for heavy CLI usage:

```json
{
  "agent-memory-cli": {
    "threads": 8,
    "cacheSize": 500,
    "ttl": 600000,
    "timeout": 90000,
    "retries": 5
  }
}
```

Flags explained:
- `--threads`: Parallel worker count (default: 4)
- `--cache-size`: LRU cache max items (default: 100, increase for large repos)
- `--ttl`: Cache TTL in milliseconds (default: 300000)
- `--timeout`: Connection timeout (default: 30s)
- `--retries`: Retry attempts on failure (default: 3)

---

## 🔄 CLI-Specific Features

### Command Logging

Automatic logging of CLI commands with context:

```typescript
// Enable command logging with memory context
await CodexCLI.enableCommandLogging({
  autoLog: true,
  includeParameters: true,
  correlateWithMemory: true,
  retentionDays: 30
});
```

### Contextual Suggestions

Get suggestions based on current project context:

```typescript
// Enhance CLI suggestions with memory
await CodexCLI.enhanceSuggestions({
  memoryEnabled: true,
  prioritizeRecent: true,
  filterByProject: true,
  considerHistory: true
});
```

### Session-Based Memory

Organize memory by development session:

```typescript
// Configure session management
await CodexCLI.configureSessions({
  autoSave: true,
  sessionTimeout: 3600000, // 1 hour
  mergeOnClose: true,
  persistenceMode: 'session-based'
});
```

---

## 🛠 Troubleshooting

### Issue: "MCP server not connecting"

**Symptoms:** Codex CLI doesn't show memory features.

**Solution:**
```bash
# Verify config file location
ls -la ~/.codex/mcp-config.json

# Validate JSON syntax
cat ~/.codex/mcp-config.json | jq .

# Test server directly
node dist/cli.js doctor
```

### Issue: "Connection timeout after 30 seconds"

**Symptoms:** CLI fails to connect within default timeout.

**Solution:** Increase timeout:

```json
{
  "agent-memory-cli": {
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

### Issue: "No command history correlation"

**Symptoms:** CLI commands not being tracked or correlated with memories.

**Solution:**
```bash
# Rebuild index
node dist/cli.js cache rebuild

# Force sync
node dist/cli.js sync --force

# Restart shell session
# Close and reopen terminal
```

---

## 📊 Performance Monitoring

Track CLI integration health regularly:

```bash
# Full diagnostic report
node dist/cli.js doctor --verbose

# CLI-specific metrics
node dist/cli.js cli stats

# Cache statistics
node dist/cli.js cache stats

# Sync status with Notion
node dist/cli.js sync --status
```

### Expected Benchmarks (v1.4.0 + Codex CLI)

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

❌ **DON'T** embed tokens in config files:
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

### CLI-Specific Security

- ✅ Config files stored outside repo (`~/.codex/`)
- ✅ Tokens never logged (verify logs regularly)
- ✅ Use separate configs for development vs production
- ✅ Consider encrypted shell environment variables

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

1. ✅ Test basic CRUD operations in Codex CLI
2. ✅ Verify memory persistence across terminal sessions  
3. ✅ Check suggestion quality with memory context
4. ✅ Monitor first-week usage patterns
5. ✅ Customize weights/ranking for your specific needs

**Want more?** Explore advanced topics in the [`GETTING_STARTED.md`](../../GETTING_STARTED.md) documentation.

---

**Copyright © 2026-present** - All rights reserved globally.

*Last Updated: 2026-09-03 | Version: 1.4.0 | Codex CLI Compatibility: 2026+*
