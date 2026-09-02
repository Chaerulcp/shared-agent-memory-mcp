# OpenCode Integration Guide

**Setup instructions for Shared Agent Memory MCP with OpenCode client.**

📍 **Target Platform:** OpenCode MCP Client  
⏱️ **Setup Time:** ~2 minutes  
✅ **Status:** Production Ready  

---

## 🎯 Features

- ✅ **Collaborative Memory Sharing** - Multiple developers access same memory store
- ✅ **Real-time Sync** - Changes propagate instantly across team
- ✅ **Context Auto-management** - Smart recall based on project context
- ✅ **Open-source Friendly** - Full transparency, customizable integration

---

## 🚀 Quick Setup

### Prerequisites

- Node.js 22+ installed
- Notion integration token ready
- OpenCode MCP client configured

### Installation Steps

1. **Install MCP Server:**
   ```bash
   git clone https://github.com/Chaerulcp/shared-agent-memory-mcp.git
   cd shared-agent-memory-mcp
   npm install && npm run build
   ```

2. **Configure Environment:**
   Create `.env` file:
   ```env
   NOTION_TOKEN=your_notion_token_here
   NOTION_DATABASE_ID=your-database-id-here
   ```

3. **Create Configuration File** (`opencode.mcp.json`):
   ```json
   {
     "mcpServers": {
       "shared-agent-memory": {
         "transport": {
           "type": "stdio",
           "command": "node",
           "args": ["dist/index.js"]
         }
       }
     },
     "env": {
       "NOTION_TOKEN": "your-notion-token",
       "NOTION_DATABASE_ID": "your-database-id"
     }
   }
   ```

4. **Start OpenCode:**
   ```bash
   opencode --config opencode.mcp.json
   ```

---

## 📊 Usage Examples

```javascript
// Access shared memory
const memories = await agentMemory.search({
  query: 'authentication best practices',
  limit: 10,
  collaborative: true // See other team members' memories
});

// Add new team decision
await agentMemory.add({
  title: 'Database Schema Decision',
  content: 'Using PostgreSQL with JSONB fields for flexible attributes.',
  metadata: {
    importance: 'high',
    tags: ['database', 'architecture'],
    author: 'team-consensus'
  }
});
```

---

## 🔒 Security Considerations

- Tokens stored externally (never in config files)
- Optional Obsidian sync for local encrypted backup
- Role-based access control through Notion permissions

---

**Copyright © 2026-present** - All rights reserved globally.

*Last Updated: 2026-09-03 | Version: 1.4.0*
