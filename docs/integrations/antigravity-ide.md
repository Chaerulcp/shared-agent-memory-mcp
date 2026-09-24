# Antigravity IDE Integration Guide

**Complete setup for Shared Agent Memory MCP with Google Antigravity IDE.**

📍 **Target Platform:** Google Antigravity IDE  
⏱️ **Setup Time:** ~3 minutes  
✅ **Status:** Production Ready  

---

## 🎯 What You Get

Integrating Agent Memory MCP with Antigravity IDE enables:

- ✅ **Persistent Project Context** - Remember decisions across IDE sessions
- ✅ **AI-Powered Context Management** - Gemini automatically recalls relevant memories
- ✅ **Multi-Agent Collaboration** - Share memory between multiple Antigravity instances
- ✅ **Smart Search Integration** - Natural language memory retrieval in IDE
- ✅ **Human-Auditable Decisions** - All memory entries visible in Notion/Obsidian

---

## 📋 Prerequisites

1. ✅ **Google Antigravity IDE** installed (v2.0+)
2. ✅ **Node.js 22+** available in system PATH
3. ✅ **Notion integration token** configured
4. ✅ **MCP Hub access** enabled in Antigravity settings

### Verify Setup

```bash
# Check Antigravity version
antigravity --version
# Expected: v2.0+

# Verify Node availability
node --version
# Expected: v22.x or higher
```

---

## 🚀 Quick Setup

### Step 1: Install and Build MCP Server

```bash
git clone https://github.com/Chaerulcp/shared-agent-memory-mcp.git
cd shared-agent-memory-mcp
npm install
npm run build
```

### Step 2: Configure Environment Variables

Create `.env` file:

```env
NOTION_TOKEN=your_notion_token_here
NOTION_DATABASE_ID=your-database-id-here
```

### Step 3: Add to Antigravity MCP Hub

In Antigravity IDE:
1. Open **Settings → MCP Hub**
2. Click "Add Server"
3. Select "Custom Server"
4. Enter configuration:

```json
{
  "name": "agent-memory",
  "type": "stdio",
  "command": "node",
  "args": ["/absolute/path/to/shared-agent-memory-mcp/dist/index.js"],
  "env": {
    "NOTION_TOKEN": "${NOTION_TOKEN}",
    "NOTION_DATABASE_ID": "${NOTION_DATABASE_ID}"
  },
  "description": "Shared agent memory for project context",
  "enabled": true
}
```

Replace `/absolute/path/to/...` with actual installation path.

### Step 4: Enable in IDE Settings

```bash
# Reload MCP servers
antigravity reload mcp

# Verify connection
node dist/cli.js doctor --sync
```

Expected output: `Overall: HEALTHY ✅`

---

## 🎯 Usage Examples

### Query Memory from the IDE

Use the Antigravity chat to call the configured MCP tools directly. The normal pattern is:

```text
Search for previous decisions about authentication, project conventions, or deployment patterns.
If the result is relevant, use it as the basis for the next step.
If the decision is new, save it with memory_add so the team can reuse it later.
```

### Add Durable Decisions

When the team agrees on a convention or fix, save it as a durable memory using `memory_add` with a clear title and a project scope. This is the recommended way to keep knowledge available across future agent sessions.

### Multi-Project Setup

For separate project databases, define a separate MCP server or an environment-specific configuration with different `NOTION_DATABASE_ID` values.

```json
{
  "mcpServers": {
    "project-alpha-memory": {
      "command": "node",
      "args": ["/absolute/path/to/shared-agent-memory-mcp/dist/index.js"],
      "env": {
        "NOTION_TOKEN": "${NOTION_TOKEN}",
        "NOTION_DATABASE_ID": "alpha-db-id"
      }
    },
    "project-beta-memory": {
      "command": "node",
      "args": ["/absolute/path/to/shared-agent-memory-mcp/dist/index.js"],
      "env": {
        "NOTION_TOKEN": "${NOTION_TOKEN}",
        "NOTION_DATABASE_ID": "beta-db-id"
      }
    }
  }
}
```

---

## 🔍 Troubleshooting

### Issue: "MCP server not connecting"

**Solution:**
```bash
# Verify JSON syntax
cat ~/.config/antigravity/mcp-config.json | jq .

# Test manually
node dist/cli.js doctor
```

### Issue: "Access denied to database"

**Solution:**
1. Open Notion database
2. Click "Share" button
3. Find "Agent Memory System"
4. Grant **"Can edit"** permission
5. Wait 30 seconds, then test again

---

## 📊 Performance Benchmarks

| Operation | Latency | Notes |
|-----------|---------|-------|
| Add Memory | 3ms | Hot tier cached |
| Delete Memory | 2ms | Index updated |
| Update Memory | 4ms | WAL protected |
| Simple Search | 12ms | Keywords only |
| Hybrid Search | 90ms | Keyword + vector |

---

## 🔒 Security Best Practices

- ✅ Store tokens externally (never in config files)
- ✅ Use environment variable substitution
- ✅ Separate configs for dev vs production
- ✅ Enable Notion encryption at rest

---

## 💡 Getting Help

- **Quick Fixes:** See [Troubleshooting](#troubleshooting) above
- **Detailed Guides:** [`docs/integrations/README.md`](../README.md)
- **Live Discussions:** [GitHub Discussions](https://github.com/Chaerulcp/shared-agent-memory-mcp/discussions)

---

**Copyright © 2026-present** - All rights reserved globally.

*Last reviewed: 2026-09-24 | Package version: 1.6.1*
