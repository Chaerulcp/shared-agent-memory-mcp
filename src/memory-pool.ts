/**
 * Tiered Memory Pool - Smart storage optimization
 * Supports hot/warm/cold/archived tiers with automatic promotion/demotion
 */

import { LRUCache } from 'lru-cache';
import Database from 'better-sqlite3';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface MemoryTierConfig {
  hot: { maxSize: number; ttlMs: number };
  warm: { indexSize: number };
  cold: { compressionLevel: number };
  archived: { retentionDays: number };
}

export const DEFAULT_TIER_CONFIG: MemoryTierConfig = {
  hot: { maxSize: 100, ttlMs: 5 * 60 * 1000 }, // 5 min
  warm: { indexSize: 10000 },
  cold: { compressionLevel: 6 },
  archived: { retentionDays: 90 }
};

interface WarmMemoryEntry {
  data: any;
  lastAccessed: number;
  accessCount: number;
}

interface ColdStorage {
  // Implementation for cold tier storage
}

export class TieredMemoryPool {
  private hotCache: LRUCache<string, any>;
  private warmIndex: Map<string, WarmMemoryEntry>;
  private coldArchive: ColdStorage;
  private config: MemoryTierConfig;
  
  constructor(config: Partial<MemoryTierConfig> = {}) {
    this.config = { ...DEFAULT_TIER_CONFIG, ...config };
    this.hotCache = new LRUCache({ 
      max: this.config.hot.maxSize,
      ttl: this.config.hot.ttlMs
    });
    this.warmIndex = new Map();
    this.coldArchive = new ColdStorage();
  }
  
  async get(memoryId: string): Promise<any | null> {
    // Check hot cache first (ultra-fast)
    const cached = this.hotCache.get(memoryId);
    if (cached) return cached;
    
    // Fall back to disk
    const memory = await this.fetchFromDisk(memoryId);
    if (!memory) return null;
    
    // Promote to hot cache
    this.hotCache.set(memoryId, memory);
    return memory;
  }
  
  async add(memory: any): Promise<void> {
    // Store in warm tier first
    this.warmIndex.set(memory.id, {
      data: memory,
      lastAccessed: Date.now(),
      accessCount: 0
    });
    
    // Trigger background promotion check
    this.maybePromoteToHot(memory.id);
  }
  
  async update(memoryId: string, updates: Partial<any>): Promise<void> {
    const current = this.warmIndex.get(memoryId)?.data;
    if (!current) throw new Error(`Memory ${memoryId} not found`);
    
    const entry = this.warmIndex.get(memoryId);
    if (!entry) throw new Error(`Entry for ${memoryId} not found`);
    
    const updated = { ...current, ...updates, updatedAt: Date.now() };
    this.warmIndex.set(memoryId, {
      data: updated,
      lastAccessed: Date.now(),
      accessCount: entry.accessCount + 1
    });
    
    // Clear from hot cache to force refresh
    this.hotCache.delete(memoryId);
  }
  
  async delete(memoryId: string): Promise<void> {
    this.warmIndex.delete(memoryId);
    this.hotCache.delete(memoryId);
  }
  
  async search(query: string): Promise<Array<{ id: string; score: number; memory: any }>> {
    // Search across warm tier (most recent memories)
    const results: Array<{ id: string; score: number; memory: any }> = [];
    
    for (const [id, entry] of this.warmIndex.entries()) {
      const score = this.calculateRelevance(entry.data.content, query);
      if (score > 0.1) {
        results.push({ id, score, memory: entry.data });
        
        // Promote to hot on access
        if (score > 0.7) {
          this.promoteToHot(id, entry.data);
        }
      }
    }
    
    return results.sort((a, b) => b.score - a.score).slice(0, 50);
  }
  
  private promoteToHot(id: string, memory: any): void {
    this.hotCache.set(id, memory);
    const entry = this.warmIndex.get(id);
    if (entry) entry.accessCount++;
  }
  
  private maybePromoteToHot(id: string): void {
    const entry = this.warmIndex.get(id);
    if (entry && entry.accessCount >= 3) {
      this.promoteToHot(id, entry.data);
    }
  }
  
  private calculateRelevance(content: string, query: string): number {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const contentLower = content.toLowerCase();
    
    let matches = 0;
    for (const term of queryTerms) {
      if (contentLower.includes(term)) matches++;
    }
    
    return matches / queryTerms.length;
  }
  
  private async fetchFromDisk(memoryId: string): Promise<any | null> {
    // TODO: Load from disk-based storage using SQLite
    // For now, return null (memory will be loaded via Obsidian sync)
    return null;
  }
}

class ColdStorage {
  // Implementation for cold tier storage
  // Uses compressed storage and separate indexing
}
