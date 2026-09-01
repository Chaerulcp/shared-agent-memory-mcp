import { createHash } from "node:crypto";

export type SyncManifest = Record<string, { path: string; hash: string }>;

export function isSafeVaultRelativePath(value: string): boolean {
  const normalized = value.replace(/\\/g, "/");
  return Boolean(normalized) && !normalized.startsWith("/") && !/^[A-Za-z]:\//.test(normalized) && !normalized.split("/").includes("..");
}

export function backupRelativePath(relativePath: string, stamp: string): string {
  if (!isSafeVaultRelativePath(relativePath)) throw new Error("Unsafe vault-relative path");
  return `backups/${stamp}/${relativePath.replace(/\\/g, "/")}`;
}

export function conflictResolutionTarget(value: string): string {
  const normalized = value.replace(/\\/g, "/");
  return normalized.endsWith(".conflict.md") ? normalized.slice(0, -12) : normalized;
}

export function buildSyncManifest(entries: Array<{ id: string; path: string; content: string }>): SyncManifest {
  return Object.fromEntries(entries.map((entry) => [entry.id, {
    path: entry.path,
    hash: contentHash(entry.content),
  }]));
}

export function contentHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function hasManualChange(content: string, lastSyncedHash?: string): boolean {
  if (!lastSyncedHash) return false;
  return contentHash(content) !== lastSyncedHash;
}

export function shouldPreserveExistingFile(hasExistingFile: boolean, lastSyncedHash?: string): boolean {
  return hasExistingFile && !lastSyncedHash;
}

export function isConflict(content: string, lastSyncedHash?: string, expectedContent?: string): boolean {
  if (lastSyncedHash) return hasManualChange(content, lastSyncedHash);
  return expectedContent !== undefined && content !== expectedContent;
}
