import { execFile } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "./config.js";
import { vaultPath } from "./obsidian.js";

function command(cmd: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd, timeout: 15000 }, (error, stdout) => {
      resolve(error ? "" : stdout.trim());
    });
  });
}

export async function runSetup(options: { dryRun?: boolean } = {}): Promise<number> {
  const root = process.cwd();
  const envFile = join(root, ".env");
  const envExample = join(root, ".env.example");
  const cfg = loadConfig();
  const vault = vaultPath();
  const checks: Array<[string, boolean, string]> = [];

  checks.push(["Project root", existsSync(join(root, "package.json")), root]);
  checks.push(["Build output", existsSync(join(root, "dist", "index.js")), "dist/index.js"]);
  checks.push(["Local .env", existsSync(envFile), envFile]);
  checks.push(["Notion token", Boolean(cfg.notionToken), "set via .env or client environment"]);
  checks.push(["Notion database ID", Boolean(cfg.databaseId), "set via .env or run init <parent-page>"]);
  checks.push(["Obsidian vault", existsSync(vault), vault]);
  checks.push(["Obsidian Git repository", existsSync(join(vault, ".git")), ".git"]);
  const remote = await command("git", ["remote", "get-url", "origin"], vault);
  checks.push(["Obsidian Git remote", Boolean(remote), remote || "origin is not configured"]);

  console.log("== shared-agent-memory-mcp setup ==");
  for (const [label, ok, detail] of checks) {
    console.log(`${ok ? "OK" : "WARN"}  ${label}: ${detail}`);
  }

  if (!existsSync(envExample) && !options.dryRun) {
    writeFileSync(envExample, "# Copy to .env and fill locally; never commit .env.\nNOTION_TOKEN=\nNOTION_DATABASE_ID=\nOBSIDIAN_VAULT_PATH=\n", "utf8");
    console.log(`Created template: ${envExample}`);
  }
  if (!existsSync(envFile)) {
    console.log(options.dryRun ? "DRY-RUN  Would create a local .env template." : "Action required: copy .env.example to .env and configure local values.");
  }
  const failed = checks.filter(([, ok]) => !ok).length;
  console.log(options.dryRun ? "DRY-RUN  No configuration was changed." : failed ? "Setup completed with warnings." : "Setup verified successfully.");
  return failed ? 1 : 0;
}
