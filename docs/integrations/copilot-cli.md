# GitHub Copilot CLI Integration Guide

**Complete setup for Shared Agent Memory MCP with GitHub Copilot Command Line Interface.**

📍 **Target Platform:** GitHub CLI + Terminal workflows  
⏱️ **Setup Time:** ~3 minutes  
✅ **Status:** Production Ready  

---

## 🎯 What You Get

Integrating Agent Memory MCP with GitHub Copilot CLI enables:

- ✅ **Session Persistence** - Context survives terminal sessions
- ✅ **Long-running Task Memory** - Remember decisions across multi-hour development tasks
- ✅ **Project Convention Enforcement** - Auto-enforce team standards in CLI
- ✅ **Command History Awareness** - Learn from past CLI patterns and decisions
- ✅ **Cross-project Knowledge** - Share insights between different repositories

---

## 📋 Prerequisites

1. ✅ **GitHub CLI (`gh`)** installed (v2.0+)
2. ✅ **Node.js 22+** available in PATH
3. ✅ **Notion integration token** configured
4. ✅ **Agent Memory MCP Server** built and ready

### Verify Setup

```bash
# Check GitHub CLI version
gh --version
# Expected: gh version 2.0.0+

# Check Node availability
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

### Step 3: Create MCP Config File

In your project root, create `copilot.mcp.json`:

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

Replace `/absolute/path/to/...` with actual installation path.

### Step 4: Enable in GitHub Copilot CLI

Add to your GitHub CLI config (`~/.config/gh/hosts.yml`):

```yaml
mcp:
  agent-memory:
    path: /path/to/copilot.mcp.json
```

Then restart your terminal session.

---

## 🎯 Usage Examples

### Query Memory in CLI

```bash
# Ask Copilot with memory context
gh copilot ask "What authentication patterns did we implement last sprint?" \
  --memory-enabled \
  --limit 5
```

### Add Decision Memory

```bash
# Record architectural decision
node dist/cli.js add \
  --title "Redis Caching Strategy" \
  --content "Using Redis Cluster for session storage with 30-min TTL." \
  --project payment-service \
  --importance high \
  --category architecture
```

### Search Recent Decisions

```bash
# Find all cache-related decisions
node dist/cli.js search cache --filter project:payment-service --limit 10
```

---

## 🔧 Advanced Configuration

### Custom Timeout Settings

For slower network connections:

```json
{
  "mcpServers": {
    "agent-memory": {
      "timeout": 60000, // 60 seconds
      "retries": 3,
      "backoff": 2.0
    }
  }
}
```

### Multi-dataset Support

Manage multiple projects:

```json
{
  "projects": {
    "payment-service": {
      "databaseId": "db-payment-id",
      "contextPrefix": "payment-"
    },
    "user-service": {
      "databaseId": "db-user-id",
      "contextPrefix": "user-"
    }
  }
}
```

---

## 🛠 Troubleshooting

### Issue: Config not loading

**Solution:**
```bash
# Verify JSON syntax
cat copilot.mcp.json | jq .

# Test connection manually
node dist/cli.js doctor --sync
```

### Issue: No memory persistence

**Solution:** Rebuild cache:

```bash
node dist/cli.js cache rebuild
```

---

**Copyright © 2026-present** - All rights reserved globally.

*Last Updated: 2026-09-03 | Version: 1.4.0*
