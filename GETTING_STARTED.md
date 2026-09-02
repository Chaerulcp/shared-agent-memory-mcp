# Quick Start Guide

**Get started with Agent Memory MCP in 5 minutes!** ⚡

This guide assumes you have basic Node.js knowledge and a Notion account.

---

## 📋 Prerequisites

Before starting, make sure you have:

- ✅ **Node.js 22 or newer** installed ([Download](https://nodejs.org/))
- ✅ **Git** installed and configured
- ✅ **Notion account** (free tier works fine)
- ✅ Basic terminal/command line familiarity

Check your setup:

```powershell
node --version        # Should show v22.x or higher
git --version         # Should be installed
```

If missing, install them first before continuing.

---

## 🚀 Installation (3 Steps)

### Step 1: Clone Repository

```powershell
git clone https://github.com/Chaerulcp/shared-agent-memory-mcp.git
cd shared-agent-memory-mcp
```

### Step 2: Install Dependencies

```powershell
npm install
npm run build
```

This will:
- Download all required packages
- Compile TypeScript to JavaScript
- Set up the MCP server for use

### Step 3: Verify Installation

```powershell
node dist/cli.js doctor
```

You should see `Overall: HEALTHY` if everything is set up correctly.

---

## 🔧 Configuration

### Create Environment Variables

Copy the example environment file:

```powershell
Copy-Item .env.example .env
```

Edit `.env` with your actual credentials:

```dotenv
# Required
NOTION_TOKEN=your_notion_integration_token_here
NOTION_DATABASE_ID=your_notion_database_id_here

# Optional - Obsidian mirror sync
OBSIDIAN_VAULT_PATH=C:/Users/your-user/Documents/ObsidianVault
```

⚠️ **Security Note:** Never commit `.env` to Git! It's already excluded by `.gitignore`.

### Get Your Notion Tokens

#### 1. Create Notion Integration

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Click "+ New integration"
3. Name it something like "Agent Memory System"
4. Copy the **Internal Integration Token** (starts with `secret_`)

#### 2. Create Memory Database

Option A: Use existing database
- Find an existing page/database in Notion
- Note its URL to extract database ID

Option B: Create new database (recommended)
```
Page → Add block → Database → Table
```

Name it "Agent Memories" or similar.

#### 3. Share Database with Integration

1. Open your memory database in Notion
2. Click "Share" button (top right)
3. Add your integration from dropdown
4. Grant "Can edit" permission
5. Copy database ID from URL or use command below

To get database ID, run:
```powershell
node dist/cli.js doctor
```
It will show available databases you can use.

---

## 🎯 First Test

Add your first memory:

```powershell
node dist/cli.js add ^
  --title "My First AI Decision" ^
  --content "This project uses React 19 with TypeScript." ^
  --agent developer ^
  --category convention ^
  --importance high ^
  --project my-app
```

Check it was created:

```powershell
node dist/cli.js search "React 19"
```

You should see your memory listed! ✅

---

## 🔌 Using with MCP Clients

### With Claude Code

Create file `claude-code.mcp.json`:

```json
{
  "mcpServers": {
    "agent-memory": {
      "command": "node",
      "args": ["C:/path/to/shared-agent-memory-mcp/dist/index.js"],
      "env": {
        "NOTION_TOKEN": "your-token-here",
        "NOTION_DATABASE_ID": "your-database-id"
      }
    }
  }
}
```

Then restart Claude Code to load the new MCP tool.

### With GitHub Copilot

See `examples/copilot-cli.mcp-config.json` for template configuration.

### Other Clients

See [`docs/integrations/`](./docs/integrations/) for specific guides.

---

## 📊 Monitoring Health

Regularly check system health:

```powershell
# Full health diagnostic
node dist/cli.js doctor --sync
```

This checks:
- ✅ Notion connection
- ✅ Cache status  
- ✅ Vault sync state
- ✅ Performance metrics

Expected output: `Overall: HEALTHY`

---

## 🔍 Common Issues

### Issue: "NOTION_TOKEN is missing"
**Solution:** Check that `.env` exists and contains valid token:
```powershell
Copy-Item .env.example .env
# Edit .env and add your tokens
```

### Issue: "Access denied to database"
**Solution:** 
1. Go to database in Notion
2. Click "Share" button
3. Find your integration
4. Grant "Can edit" permission

### Issue: Cache returns no results
**Solution:** Rebuild cache:
```powershell
node dist/cli.js cache rebuild
```

---

## 🎓 Next Steps

Once comfortable with basics:

1. **Explore CLI features**:
   ```powershell
   node dist/cli.js --help
   ```

2. **Read full documentation**: [`README.md`](../README.md)

3. **Join discussions**: [GitHub Discussions](https://github.com/Chaerulcp/shared-agent-memory-mcp/discussions)

4. **Try advanced features**: Vector search, project scoping, conflict resolution

---

## 💡 Tips for Success

- **Start small**: Add 2-3 memories initially to test functionality
- **Use categories**: Tag memories properly for better organization
- **Test regularly**: Run `doctor --sync` weekly
- **Backup vault**: If using Obsidian sync, keep local backups
- **Stay updated**: Watch repository for feature releases

---

**Ready to dive deeper?** Check out the [full documentation](../README.md) next! 😊
