import { execFileSync } from "node:child_process";
import { basename } from "node:path";

export function normalizeProjectName(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 120);
}

export function projectFromRemote(remote: string): string | undefined {
  const value = remote.trim();
  const match = value.match(/(?:github\.com[/:])([^/ :]+)\/([^/]+?)(?:\.git)?$/i);
  if (!match) return undefined;
  const owner = normalizeProjectName(match[1]);
  const repository = normalizeProjectName(match[2]);
  return owner && repository ? `${owner}/${repository}` : undefined;
}

function git(args: string[], cwd: string): string | undefined {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || undefined;
  } catch {
    return undefined;
  }
}

export function detectProjectContext(cwd = process.cwd()): string | undefined {
  const explicit = normalizeProjectName(process.env.AGENT_PROJECT ?? "");
  if (explicit) return explicit;
  const remote = git(["config", "--get", "remote.origin.url"], cwd);
  const fromOrigin = remote ? projectFromRemote(remote) : undefined;
  if (fromOrigin) return fromOrigin;
  const root = git(["rev-parse", "--show-toplevel"], cwd);
  if (!root) return undefined;
  return normalizeProjectName(basename(root));
}

export function resolveProject(explicit?: string, cwd = process.cwd()): string | undefined {
  const provided = normalizeProjectName(explicit ?? "");
  return provided || detectProjectContext(cwd);
}
