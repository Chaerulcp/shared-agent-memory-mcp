import { createHash } from "node:crypto";

export type SyncManifest = Record<string, { path: string; hash: string }>;

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

export function isConflict(content: string, lastSyncedHash?: string): boolean {
  return shouldPreserveExistingFile(true, lastSyncedHash) || hasManualChange(content, lastSyncedHash);
}
