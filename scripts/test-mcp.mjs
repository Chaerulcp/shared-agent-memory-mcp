// Tes MCP server via stdio: initialize -> tools/list -> tools/call
import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["dist/index.js"], {
  cwd: new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  stdio: ["pipe", "pipe", "inherit"],
  env: process.env,
});

let buf = "";
const pending = new Map();

child.stdout.on("data", (d) => {
  buf += d.toString();
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

let nextId = 1;
function rpc(method, params) {
  const id = nextId++;
  const p = new Promise((resolve) => pending.set(id, resolve));
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  return p;
}
function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

const init = await rpc("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "setup-test", version: "1.0.0" },
});
console.log("initialize  :", init.result.serverInfo?.name, init.result.serverInfo?.version);
notify("notifications/initialized", {});

const list = await rpc("tools/list", {});
console.log("tools/list  :", list.result.tools.map((t) => t.name).join(", "));

const search = await rpc("tools/call", {
  name: "memory_search",
  arguments: { query: "setup notion", limit: 3 },
});
console.log("memory_search:", search.result.content[0].text.slice(0, 400).replace(/\s+/g, " "));

const recent = await rpc("tools/call", { name: "memory_recent", arguments: { limit: 2 } });
console.log("memory_recent:", recent.result.content[0].text.slice(0, 200).replace(/\s+/g, " "));

child.kill();
process.exit(0);
