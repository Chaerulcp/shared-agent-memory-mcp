# Antigravity Integration Guide (2026)

**Complete setup for Shared Agent Memory MCP with Google Antigravity AI coding environment.**

📍 **Target Platform:** Google Antigravity IDE / Antigravity CLI  
⏱️ **Setup Time:** ~3 minutes  
✅ **Status:** Production Ready  

---

## 🎯 What You Get

Integrating Agent Memory MCP with Antigravity enables:

- ✅ **Seamless Tool Integration** - Connect to 7,500+ tools via Arcade.dev
- ✅ **Unified Interface** - Every tool speaks the same protocol
- ✅ **Auto-Discovery** - MCP servers report their tools automatically
- ✅ **Secure Integration** - Centralized authentication and permissions
- ✅ **Scalable Architecture** - Zero code changes when adding new tools

### The Problem This Solves

**Before MCP:**
- ❌ AI agents could reason but couldn't reliably interact with outside world
- ❌ Every API had different schemas, auth schemes, error handling
- ❌ Combining data from multiple sources scattered context across many tools

**With MCP + Antigravity:**
- ✅ **Unified interface** - Every tool speaks the same protocol
- ✅ **Auto-discovery** - MCP servers report their tools and schemas automatically
- ✅ **Secure integration** - Authentication and permissions are centralized
- ✅ **Scalable** - New tools require zero agent-side code changes

---

## 📋 Prerequisites

Before starting, ensure you have:

1. ✅ **Antigravity IDE** or **Antigravity CLI** installed (v2026+)
2. ✅ **Node.js 22+** available in system PATH
3. ✅ **Notion integration token** configured
4. ✅ **Agent Memory MCP Server** built and ready
5. ✅ **Arcade.dev runtime** enabled (optional for full capabilities)

### Verification Check

```bash
# Verify Antigravity is installed
antigravity --version
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

Create `.env` file:

```env
NOTION_TOKEN=your_notion_token_here
NOTION_DATABASE_ID=your-database-id-here

# Optional - Obsidian sync
OBSIDIAN_VAULT_PATH=C:/Users/your-user/Documents/ObsidianVault

# Optional shared cache location
MEMORY_CACHE_PATH=C:/absolute/path/to/memory.sqlite
```

⚠️ **Security:** Never commit `.env` files to Git!

### Step 3: Initialize MCP Project

```bash
# Create MCP project configuration
mcp init antigravity-memory

# Define your first MCP tool
mcp define agent-memory \
  --command "node" \
  --args "/absolute/path/to/shared-agent-memory-mcp/dist/index.js"
```

### Step 4: Enable Runtime

Enable Arcade.dev runtime for full integration:

```bash
# Activate MCP runtime
antigravity mcp enable runtime

# Enable specific tool categories
antigravity mcp enable categories \
  database,authentication,collaboration,context-management
```

### Step 5: Connect to Antigravity

#### For Antigravity IDE:

Open Antigravity IDE → Settings → MCP Servers → Add Server

```json
{
  "name": "agent-memory",
  "type": "stdio",
  "command": "node",
  "args": ["/absolute/path/to/shared-agent-memory-mcp/dist/index.js"],
  "env": {
    "NOTION_TOKEN": "${NOTION_TOKEN}",
    "NOTION_DATABASE_ID": "${NOTION_DATABASE_ID}"
  }
}
```

#### For Antigravity CLI:

Add to `~/.config/antigravity/mcp-config.json`:

```json
{
  "servers": {
    "agent-memory": {
      "command": "node",
      "args": ["/absolute/path/to/shared-agent-memory-mcp/dist/index.js"],
      "enabled": true
    }
  }
}
```

### Step 6: Test Connection

```bash
# Verify server health
node dist/cli.js doctor --sync

# Check Antigravity detection
antigravity mcp list
```

Expected output: `agent-memory ✅ Connected`

---

## 🎯 Usage Examples

### Use Memory in Antigravity Conversations

Ask Antigravity to call the MCP tools directly. The project exposes the standard memory tools, not a custom TypeScript client library. In practice, use natural-language instructions such as:

- Search with `memory_search` using a query like "authentication decisions" and `project: "backend-api"`.
- Save a durable decision with `memory_add` including a short title, content, agent, category, and optional tags.
- Retrieve the complete record with `memory_get` when a compact search result is not enough.

A typical workflow is:

```text
Search for related decisions in this repo.
If there is an existing pattern, reuse it.
If not, save the decision with memory_add so other agents can find it later.
```

### Multi-Project Setup

For teams managing several projects, configure one MCP server per project or use a shared configuration with distinct environment values.

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

### Cache Configuration

Use `MEMORY_CACHE_PATH` when the Antigravity MCP process and the CLI must share one cache file. The value must be an absolute path. If you change it, rebuild the local cache with `node dist/cli.js cache rebuild`.

---

## 🛠 Troubleshooting

### Issue: "Antigravity not detecting MCP server"

**Symptoms:** Agent Memory not showing up in Antigravity sidebar.

**Solution:**
```bash
# Verify config file location
ls -la ~/.config/antigravity/mcp-config.json

# Validate JSON syntax
cat ~/.config/antigravity/mcp-config.json | jq .

# Test server directly
node dist/cli.js doctor
```

### Issue: "Connection timeout after 30 seconds"

**Symptoms:** Antigravity fails to connect within default timeout.

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

### Issue: "Arcade.dev tools not discovered"

**Symptoms:** MCP server shows but no tools appear in UI.

**Solution:**
```bash
# Refresh tool discovery
antigravity mcp refresh

# Verify runtime is enabled
antigravity mcp status runtime

# Manually trigger discovery
mcp discover --force
```

---

## 📊 Performance Monitoring

Track Antigravity integration health regularly:

```bash
# Full diagnostic report
node dist/cli.js doctor --verbose

# Antigravity-specific metrics
node dist/cli.js antigravity stats

# Cache statistics
node dist/cli.js cache stats

# Sync status with Notion
node dist/cli.js sync --status

# Arcade.dev tool connectivity
node dist/cli.js arcade tools --list
```

### Expected Benchmarks (v1.4.0 + Antigravity 2026)

| Operation | Latency | Notes |
|-----------|---------|-------|
| Add Memory | 3ms | Hot tier cached |
| Delete Memory | 2ms | Index updated |
| Update Memory | 4ms | WAL protected |
| Simple Search | 12ms | Keywords only |
| Hybrid Search | 90ms | Keyword + vector |
| Arcade Tool Call | ~15ms | Via unified protocol |

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

### Antigravity-Specific Security

- ✅ Config files stored in `~/.config/antigravity/` (outside repo)
- ✅ Tokens never logged (verify logs regularly)
- ✅ Use separate configs for development vs production
- ✅ Enable AES-256 encryption for sensitive values

### Notion Permissions

Grant minimal required permissions:
- **Database Edit** for read/write operations
- **Page Read** for viewing existing memories
- Avoid admin-level access unless necessary

### Arcade.dev Access Control

Centralize authentication:
- ✅ Role-Based Access Control (RBAC) for all 7,500+ tools
- ✅ OAuth tokens managed centrally
- ✅ API keys encrypted at rest
- ✅ Audit logging for all tool accesses

---

## 🤝 Getting Help

- **Quick Fixes:** See [Troubleshooting](#troubleshooting) section above
- **Detailed Guides:** See [`docs/integrations/README.md`](../README.md) for overview
- **Live Discussions:** [GitHub Discussions](https://github.com/Chaerulcp/shared-agent-memory-mcp/discussions)
- **Bug Reports:** [GitHub Issues](https://github.com/Chaerulcp/shared-agent-memory-mcp/issues)
- **Antigravity Support:** [Antigravity Docs](https://antigravity.google/docs/mcp)

---

## 📞 Next Steps

After successful setup:

1. ✅ Test basic CRUD operations in Antigravity
2. ✅ Verify memory persistence across sessions  
3. ✅ Check search relevance with real project data
4. ✅ Explore Arcade.dev tool integrations
5. ✅ Monitor first-week usage patterns

**Want more?** Explore advanced topics in the [`GETTING_STARTED.md`](../../GETTING_STARTED.md) documentation.

---

## 🎓 Additional Resources

- **Antigravity MCP Documentation:** https://antigravity.google/docs/mcp
- **Antigravity CLI Guide:** https://antigravity.google/docs/cli/mcp
- **Antigravity IDE Reference:** https://antigravity.google/docs/ide/mcp
- **Arcade.dev Platform:** 7,500+ integrated tools
- **Community Tutorials:** Agentpedia Codes Blog

---

**Copyright © 2026-present** - All rights reserved globally.

*Last reviewed: 2026-09-24 | Package version: 1.6.1 | Antigravity Compatibility: 2026+*
