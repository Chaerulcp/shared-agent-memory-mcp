#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  AGENTS,
  CATEGORIES,
  IMPORTANCE,
  STATUSES,
  addMemory,
  deleteMemory,
  getMemory,
  searchMemories,
  updateMemory,
} from "./store.js";

const server = new McpServer({
  name: "notion-agent-memory",
  version: "1.0.0",
});

function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function fail(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: "text" as const, text: `ERROR: ${message}` }],
    isError: true,
  };
}

const agentEnum = z.enum(AGENTS);
const categoryEnum = z.enum(CATEGORIES);
const importanceEnum = z.enum(IMPORTANCE);
const statusEnum = z.enum(STATUSES);
const tagsSchema = z.array(z.string().trim().min(1).max(40)).max(10);

server.registerTool(
  "memory_search",
  {
    description:
      "Search the shared long-term memory stored in Notion (used by Cline, OpenCode, Claude Code, GitHub Copilot, Hermes). " +
      "Returns matching memories with id, title, content, agent, category, tags. " +
      "USE THIS at the start of a task with relevant keywords, and before making decisions, " +
      "to reuse saved preferences, conventions, and past decisions.",
    inputSchema: {
      query: z.string().describe("Keywords/phrase to match in title, content, and tags"),
      agent: agentEnum.optional().describe("Only memories saved by this agent"),
      category: categoryEnum.optional(),
      tag: z.string().optional().describe("Exact tag name to filter by"),
      limit: z.number().int().min(1).max(25).default(10),
    },
  },
  async (args) => {
    try {
      const results = await searchMemories({ ...args });
      return ok({ count: results.length, results });
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  "memory_recent",
  {
    description:
      "List the most recently updated memories from the shared Notion memory. " +
      "Use to get context about what was learned/saved lately.",
    inputSchema: {
      agent: agentEnum.optional(),
      limit: z.number().int().min(1).max(25).default(5),
    },
  },
  async (args) => {
    try {
      const results = await searchMemories({ agent: args.agent, limit: args.limit });
      return ok({ count: results.length, results });
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  "memory_get",
  {
    description: "Fetch a single memory by its id (full content).",
    inputSchema: {
      id: z.string().describe("Notion page id of the memory"),
    },
  },
  async (args) => {
    try {
      return ok(await getMemory(args.id));
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  "memory_add",
  {
    description:
      "Save a new durable memory into the shared Notion memory. " +
      "USE THIS when: the user states a preference, a project decision is made, " +
      "a convention is established, a non-obvious bug is fixed (root cause + fix), " +
      "or important project/environment context is learned. " +
      "Do NOT store secrets, tokens, or throwaway information.",
    inputSchema: {
      title: z.string().min(3).max(200).describe("Short, searchable, imperative title (<= 80 chars recommended)"),
      content: z.string().min(3).max(20000).describe("Full memory content: concise but complete, with examples when helpful"),
      agent: agentEnum.describe("Which agent is saving this; use 'shared' for universal rules"),
      category: categoryEnum.default("other"),
      tags: tagsSchema.optional().describe("Lowercase tags, e.g. ['typescript','ui','deploy']"),
      importance: importanceEnum.default("medium"),
    },
  },
  async (args) => {
    try {
      const memory = await addMemory({
        title: args.title,
        content: args.content,
        agent: args.agent,
        category: args.category,
        tags: args.tags ?? [],
        importance: args.importance,
      });
      return ok({ saved: true, memory });
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  "memory_update",
  {
    description:
      "Update an existing memory by id. Prefer updating over creating duplicates " +
      "when knowledge changes or gets corrected.",
    inputSchema: {
      id: z.string().describe("Notion page id of the memory"),
      title: z.string().min(3).max(200).optional(),
      content: z.string().min(3).max(20000).optional(),
      agent: agentEnum.optional(),
      category: categoryEnum.optional(),
      tags: tagsSchema.optional(),
      importance: importanceEnum.optional(),
      status: statusEnum.optional(),
    },
  },
  async (args) => {
    try {
      const { id, ...patch } = args;
      const memory = await updateMemory(id, patch);
      return ok({ updated: true, memory });
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  "memory_delete",
  {
    description:
      "Archive a memory (default) or move it to Notion trash (hard=true). " +
      "Use when a memory is wrong or obsolete.",
    inputSchema: {
      id: z.string().describe("Notion page id of the memory"),
      hard: z.boolean().default(false),
    },
  },
  async (args) => {
    try {
      await deleteMemory(args.id, args.hard);
      return ok({ deleted: true, id: args.id, hard: args.hard });
    } catch (err) {
      return fail(err);
    }
  }
);


async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[notion-agent-memory] MCP server aktif (storage: Notion)");
}

main().catch((err) => {
  console.error("[notion-agent-memory] Fatal:", err);
  process.exit(1);
});
