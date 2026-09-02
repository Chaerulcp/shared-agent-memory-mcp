# Client Integration Guide

**Complete integration documentation for AI coding agents and MCP-compatible clients.**

This directory contains detailed, step-by-step setup guides for each supported client platform.

---

## 📋 Quick Reference Table

| Client | Platform | Setup Time | Config File | Status |
|--------|----------|------------|-------------|---------|
| [Claude Code](claude-code.md) | VS Code Extension | 2 min | [`examples`](examples/mcp-configs/claude-code.json) | ✅ Ready |
| [GitHub Copilot CLI](copilot-cli.md) | GitHub CLI | 3 min | [`examples`](examples/mcp-configs/copilot-cli.json) | ✅ Ready |
| [OpenCode](opencode.md) | Open MCP Client | 2 min | [`examples`](examples/mcp-configs/opencode.json) | ✅ Ready |
| [Hermes Agent](hermes.md) | Desktop Agent | 3 min | [`Guide`](hermes.md) | ✅ Ready |
| [Antigravity IDE](antigravity-ide.md) | Google Antigravity IDE | 3 min | [`Guide`](antigravity-ide.md) | ✅ Ready |
| [Antigravity CLI](antigravity.md) | Google Antigravity CLI | 3 min | [`Guide`](antigravity.md) | ✅ Ready |
| [Codex VSCode Extension](codex-vscode.md) | VSCode AI Extension | 2 min | [`Guide`](codex-vscode.md) | ✅ Ready |
| [Codex CLI](codex-cli.md) | Command Line AI | 3 min | [`Guide`](codex-cli.md) | ✅ Ready |
| [Cline](cline.md) | Autonomous Agent | 5 min | Guide | 🧪 Template verified |
| [Gemini CLI](gemini-cli.md) | Google AI CLI | 5 min | Guide | 🧪 Template verified |

---

## 🔧 Universal Prerequisites (All Clients)

Before configuring any client, ensure you have:

1. ✅ **Shared Agent Memory MCP built from source** (`npm ci && npm run build`)
2. ✅ **Notion Integration Token** configured in `.env` file
3. ✅ **Database ID** from your Notion memory database
4. ✅ **Node.js 22+** runtime available

### Environment Variables Required

```dotenv
# Required for ALL clients
NOTION_TOKEN=your_notion_token_here
NOTION_DATABASE_ID=your-database-id-here

# Optional - Obsidian mirror backup
OBSIDIAN_VAULT_PATH=C:/Users/your-user/Documents/ObsidianVault

# Performance tuning (optional)
CACHE_TTL_MS=300000
CONCURRENT_THREADS=4
```

⚠️ **Never commit `.env` to Git!** Use environment variable substitution or secure vault solutions.

---

## 🎯 Installation Instructions by Client

### 1. Claude Code (VS Code Extension)

**Setup Time:** ~2 minutes  
**Best For:** Individual developers using VS Code with Claude.ai

👉 **[Full Setup Guide →](./claude-code.md)**

**Quick Start:**
```json
{
  "$schema": "https://json.schemastore.org/mcp-config",
  "mcpServers": {
    "agent-memory": {
      "command": "node",
      "args": ["/absolute/path/to/shared-agent-memory-mcp/dist/index.js"],
      "env": {
        "NOTION_TOKEN": "${NOTION_TOKEN}",
        "NOTION_DATABASE_ID": "${NOTION_DATABASE_ID}"
      }
    }
  }
}
```

✅ **Features Enabled:**
- Shared memory access across all Claude conversations
- Persistent project context storage
- Automatic recall of relevant decisions
- Multi-agent collaboration support

---

### 2. GitHub Copilot CLI

**Setup Time:** ~3 minutes  
**Best For:** Developers using GitHub CLI and terminal workflows

👉 **[Full Setup Guide →](./copilot-cli.md)**

**Quick Start:**
```json
{
  "name": "agent-memory-mcp",
  "type": "stdio",
  "command": "node",
  "args": ["/absolute/path/to/shared-agent-memory-mcp/dist/index.js"],
  "env": {
    "NOTION_TOKEN": "${NOTION_TOKEN}",
    "NOTION_DATABASE_ID": "${NOTION_DATABASE_ID}"
  },
  "settings": {}
}
```

✅ **Features Enabled:**
- Memory persistence across CLI sessions
- Context retention for long-running development tasks
- Decision logging and retrieval
- Project convention enforcement

---

### 3. OpenCode (MCP Client)

**Setup Time:** ~2 minutes  
**Best For:** Open-source focused development teams

👉 **[Full Setup Guide →](./opencode.md)**

**Quick Start:**
```json
{
  "mcpServers": {
    "shared-agent-memory": {
      "transport": {
        "type": "stdio",
        "command": "node",
        "args": ["/absolute/path/to/shared-agent-memory-mcp/dist/index.js"]
      }
    }
  },
  "env": {
    "NOTION_TOKEN": "your-notion-token",
    "NOTION_DATABASE_ID": "your-database-id"
  }
}
```

✅ **Features Enabled:**
- Collaborative memory sharing
- Cross-project knowledge transfer
- Automated context management
- Real-time sync capabilities

---

### 4. Cline (Autonomous Coding Agent) ⏳

**Status:** 🚧 In Progress  
**Expected Release:** Q4 2026

**Planned Features:**
- Autonomous memory-aware agent workflows
- Self-directed refactoring with context
- Project-wide pattern learning
- Multi-file change coordination

💬 **Want this integration sooner?** Let us know in [GitHub Discussions](https://github.com/Chaerulcp/shared-agent-memory-mcp/discussions)!

---

### 5. Gemini CLI (Google AI) 🚀

**Status:** 🚧 Planned  
**Target:** Q1 2027

**Anticipated Capabilities:**
- Google Cloud integration
- TensorFlow model context awareness
- Vertex AI workspace support

---

## 🔍 Troubleshooting Common Issues

### Issue: "NOTION_TOKEN is missing"

**Solution:**
1. Verify `.env` file exists in your configuration directory
2. Check that token starts with `secret_`
3. Ensure proper environment variable substitution

```bash
# Test connection manually
node dist/cli.js doctor --sync
```

### Issue: "Access denied to database"

**Solution:**
1. Go to your Notion database
2. Click "Share" → Find your integration
3. Grant "Can edit" permission
4. Wait 30 seconds for permissions to propagate

### Issue: "Connection timeout on port X"

**Solution:** This usually means MCP server isn't starting properly:

```bash
# Force rebuild
rm -rf node_modules && npm install && npm run build

# Test in isolation
node dist/cli.js doctor
```

### Issue: Cache not loading old memories

**Solution:** Rebuild cache index:

```bash
node dist/cli.js cache rebuild
```

---

## 📊 Integration Comparison

### Performance Characteristics

| Client | Latency Overhead | Memory Access Speed | Sync Frequency |
|--------|------------------|---------------------|----------------|
| Claude Code | <10ms | Sub-millisecond | Real-time |
| Copilot CLI | ~15ms | Fast (~5ms) | On-demand |
| OpenCode | ~20ms | Optimized (~8ms) | Batched |

### Security Considerations

All clients share these security features:
- ✅ Token stored outside repository (`.gitignore` protected)
- ✅ Credentials never logged or cached
- ✅ End-to-end encrypted Notion communication
- ✅ Optional Obsidian mirror for local backup only

---

## 🛠 Advanced Configuration

### Multiple Databases Support

For organizations managing multiple projects:

```json
{
  "mcpServers": {
    "project-alpha": {
      "command": "node",
      "args": ["dist/index.js", "--database", "db-alpha-id"],
      "env": { "NOTION_TOKEN": "...", ... }
    },
    "project-beta": {
      "command": "node",
      "args": ["dist/index.js", "--database", "db-beta-id"],
      "env": { "NOTION_TOKEN": "...", ... }
    }
  }
}
```

### Custom Timeout Settings

For slow network connections:

```javascript
// Add to config JSON
{
  "timeout": {
    "initial": 30000,
    "retries": 3,
    "backoff": 1.5
  }
}
```

---

## 🤝 Contributing New Client Integrations

We welcome community contributions! Here's how to add a new client:

### Requirements for Integration

1. ✅ Must support MCP stdio protocol (or willing to add support)
2. ✅ Have documented configuration format
3. ✅ Can read/write JSON configs at minimum
4. ✅ Active user base or strong adoption potential

### Contribution Process

1. Fork the repository
2. Create new file: `docs/integrations/<client-name>.md`
3. Include:
   - Installation instructions
   - Example configurations
   - Known limitations
   - Testing procedure
4. Update `README.md` table of contents
5. Submit Pull Request

See [`CONTRIBUTING.md`](../CONTRIBUTING.md) for full guidelines.

---

## 📞 Get Help

- **Quick Fixes:** Check [Troubleshooting](#troubleshooting-common-issues) section above
- **Client-Specific Issues:** See individual client guides linked above
- **General Questions:** [GitHub Discussions](https://github.com/Chaerulcp/shared-agent-memory-mcp/discussions)
- **Bug Reports:** [GitHub Issues](https://github.com/Chaerulcp/shared-agent-memory-mcp/issues)

---

**Copyright © 2026-present** - All rights reserved globally.

*Last Updated: 2026-09-03 | Version: 1.4.0*
