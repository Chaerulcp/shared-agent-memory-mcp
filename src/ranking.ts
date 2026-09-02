/**
 * Query Optimization & Ranking System
 * Intelligent relevance scoring based on multiple factors
 */

import { LRUCache } from 'lru-cache';

export interface RankedResult {
  id: string;
  baseScore: number;        // Original search relevance (FTS/vector)
  recencyBonus: number;     // Recent memories boosted
  projectMatchBonus: number; // Matches current project context
  frequencyBoost: number;   // Frequently accessed memories promoted
  freshnessPenalty: number; // Very old memories deprioritized
  finalScore: number;       // Weighted combined score
  rank: number;
  memory: any;
}

export interface QueryContext {
  projectId?: string;       // Current project filter
  userId?: string;          // User for personalization
  timeRange?: string;       // Time window (e.g., '30d', '90d')
  includeArchived?: boolean;
}

export interface RankingConfig {
  weights: {
    recency: number;        // Weight for recency factor (0-1)
    projectMatch: number;   // Weight for project context match
    frequency: number;      // Weight for access frequency
    freshness: number;      // Weight for age-based penalty
  };
  
  thresholds: {
    recentDays: number;     // Thresholds for "recent" classification
    freshDays: number;      // What counts as "fresh"
    staleDays: number;      // When to apply penalty
  };
  
  limits: {
    maxRecencyBoost: number;
    maxProjectBonus: number;
    maxFrequencyBoost: number;
    minFinalScore: number;
  };
}

const DEFAULT_RANKING_CONFIG: RankingConfig = {
  weights: {
    recency: 0.15,          // 15% weight
    projectMatch: 0.15,     // 15% weight
    frequency: 0.1,         // 10% weight
    freshness: 0.1          // 10% weight (penalty only)
  },
  
  thresholds: {
    recentDays: 7,          // < 7 days = very recent
    freshDays: 30,          // < 30 days = fresh
    staleDays: 90           // > 90 days = start penalizing
  },
  
  limits: {
    maxRecencyBoost: 0.3,   // Max +30% boost
    maxProjectBonus: 0.25,  // Max +25% bonus
    maxFrequencyBoost: 0.15,// Max +15% boost
    minFinalScore: 0.1      // Minimum threshold for results
  }
};

export class QueryRankingOptimizer {
  private config: RankingConfig;
  private accessCache: LRUCache<string, { count: number; lastAccess: number }>;
  
  constructor(config?: Partial<RankingConfig>) {
    this.config = { ...DEFAULT_RANKING_CONFIG, ...config };
    
    // Cache for access frequency data (top 10k accessed items)
    this.accessCache = new LRUCache({
      max: 10000,
      ttl: 1000 * 60 * 60 // 1 hour TTL
    });
  }
  
  /**
   * Main ranking function - applies all scoring factors
   */
  optimize(
    results: Array<{id: string; score: number; memory: any}>,
    context: QueryContext
  ): RankedResult[] {
    // Phase 1: Calculate base scores
    const scored = results.map(result => ({
      ...result,
      recencyBonus: this.calculateRecencyBonus(result.memory),
      projectMatchBonus: this.calculateProjectMatch(result.memory, context),
      frequencyBoost: this.calculateFrequencyBoost(result.id),
      freshnessPenalty: this.calculateFreshnessPenalty(result.memory)
    }));
    
    // Phase 2: Apply weighted combination
    const weighted = scored.map(item => ({
      id: item.id,
      score: item.score,
      memory: item.memory,
      baseScore: item.score,
      recencyBonus: item.recencyBonus,
      projectMatchBonus: item.projectMatchBonus,
      frequencyBoost: item.frequencyBoost,
      freshnessPenalty: item.freshnessPenalty,
      finalScore: this.computeWeightedSum([
        {score: item.score, weight: 0.5},        // Base relevance (50%)
        {score: item.recencyBonus, weight: 0.15}, // Recency (15%)
        {score: item.projectMatchBonus, weight: 0.15}, // Project match (15%)
        {score: item.frequencyBoost, weight: 0.1}, // Frequency (10%)
        {score: item.freshnessPenalty, weight: 0.1} // Age penalty (10%)
      ]),
      rank: 0 // Will be set after sorting
    }) as RankedResult);
    
    // Phase 3: Sort by final score and assign ranks
    return weighted
      .filter(r => r.finalScore >= this.config.limits.minFinalScore)
      .sort((a, b) => b.finalScore - a.finalScore)
      .map((r, index) => ({
        ...r,
        rank: index + 1
      }))
      .slice(0, 50); // Limit to top 50 results
  }
  
  /**
   * Calculate recency bonus - more recent = higher score
   */
  private calculateRecencyBonus(memory: any): number {
    const createdAt = new Date(memory.createdAt || Date.now());
    const now = new Date();
    const daysSinceCreated = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceCreated <= this.config.thresholds.recentDays) {
      // Very recent: full boost
      return this.config.limits.maxRecencyBoost;
    } else if (daysSinceCreated <= this.config.thresholds.freshDays) {
      // Fresh: moderate boost (linear decay)
      const progress = (daysSinceCreated - this.config.thresholds.recentDays) / 
                       (this.config.thresholds.freshDays - this.config.thresholds.recentDays);
      return this.config.limits.maxRecencyBoost * (1 - progress) * 0.5;
    }
    
    return 0;
  }
  
  /**
   * Calculate project match bonus
   */
  private calculateProjectMatch(memory: any, context: QueryContext): number {
    if (!context.projectId) return 0;
    
    const memoryTags = Array.isArray(memory.tags) ? memory.tags : [];
    const memoryProject = memory.project || '';
    
    // Exact project match
    if (memoryProject === context.projectId) {
      return this.config.limits.maxProjectBonus;
    }
    
    // Tag contains project name
    if (memoryTags.includes(context.projectId)) {
      return this.config.limits.maxProjectBonus * 0.5;
    }
    
    return 0;
  }
  
  /**
   * Calculate frequency boost based on access patterns
   */
  private calculateFrequencyBoost(id: string): number {
    const cached = this.accessCache.get(id);
    
    if (!cached) return 0; // Never accessed = no boost
    
    const accessCount = cached.count;
    
    if (accessCount >= 10) {
      // Highly frequent: max boost
      return this.config.limits.maxFrequencyBoost;
    } else if (accessCount >= 3) {
      // Moderately frequent: linear boost
      return this.config.limits.maxFrequencyBoost * (accessCount / 10);
    }
    
    return 0;
  }
  
  /**
   * Calculate freshness penalty - older = slightly lower priority
   */
  private calculateFreshnessPenalty(memory: any): number {
    const updatedAt = new Date(memory.updatedAt || memory.createdAt || Date.now());
    const now = new Date();
    const daysSinceUpdated = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceUpdated > this.config.thresholds.staleDays) {
      // Old content: apply penalty
      const excess = daysSinceUpdated - this.config.thresholds.staleDays;
      const penalty = 0.15 * (excess / 30); // Increase penalty over time
      return Math.min(penalty, 0.15); // Cap at 15%
    }
    
    return 0;
  }
  
  /**
   * Compute weighted sum with normalization
   */
  private computeWeightedSum(scores: Array<{score: number; weight: number}>): number {
    const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
    
    if (totalWeight === 0) return 0;
    
    const weightedTotal = scores.reduce((sum, s) => {
      return sum + (s.score * s.weight);
    }, 0);
    
    return weightedTotal / totalWeight;
  }
  
  /**
   * Update access frequency cache
   */
  recordAccess(id: string): void {
    const existing = this.accessCache.get(id) || { count: 0, lastAccess: 0 };
    
    this.accessCache.set(id, {
      count: existing.count + 1,
      lastAccess: Date.now()
    });
  }
  
  /**
   * Clear access frequency data
   */
  clearAccessData(): void {
    this.accessCache.clear();
  }
  
  getConfig(): RankingConfig {
    return { ...this.config };
  }
  
  updateConfig(updates: Partial<RankingConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

export default QueryRankingOptimizer;
