/**
 * Hybrid Search Router - Intelligent combination of keyword + semantic search
 * Auto-routes queries based on complexity and context
 */

import Database from 'better-sqlite3';
import { IncrementalIndex } from './incremental-index.js';
import { VectorSearchIndex } from './vector-search.js';

export interface HybridSearchConfig {
  // Enable/disable vector search (opt-in)
  vectorEnabled: boolean;
  
  // Query routing strategy
  routingStrategy: 'automatic' | 'force-keyword' | 'force-vector';
  
  // Similarity thresholds
  keywordThreshold: number;   // Minimum FTS match score
  vectorThreshold: number;    // Minimum cosine similarity
  
  // Result merging
  mergeStrategy: 'union' | 'intersection' | 'reciprocal-rank-fusion';
  rrfK: number;              // RRF parameter (default 60)
  
  // Performance tuning
  maxVectorResults: number;
  maxKeywordResults: number;
  timeoutMs: number;         // Abort vector search if too slow
}

const DEFAULT_CONFIG: HybridSearchConfig = {
  vectorEnabled: false,        // Default OFF to avoid overhead
  routingStrategy: 'automatic',
  keywordThreshold: 0.1,
  vectorThreshold: 0.6,
  mergeStrategy: 'reciprocal-rank-fusion',
  rrfK: 60,
  maxVectorResults: 50,
  maxKeywordResults: 100,
  timeoutMs: 2000             // 2 second timeout for vector search
};

export class HybridSearchRouter {
  private index: IncrementalIndex;
  private vectorIndex: VectorSearchIndex;
  private config: HybridSearchConfig;
  
  constructor(
    index: IncrementalIndex,
    vectorIndex: VectorSearchIndex,
    config?: Partial<HybridSearchConfig>
  ) {
    this.index = index;
    this.vectorIndex = vectorIndex;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize vector search if enabled
    if (this.config.vectorEnabled) {
      this.vectorIndex.initialize();
    }
  }
  
  /**
   * Main search entry point - intelligently combines results
   */
  async search(query: string, options: {
    limit?: number;
    project?: string;
    includeArchived?: boolean;
  } = {}): Promise<Array<{
    id: string;
    score: number;
    rank: number;
    memory: any;
    source: 'keyword' | 'vector' | 'fusion';
  }>> {
    const startTime = Date.now();
    
    // Detect query type and route accordingly
    const shouldUseVector = this.shouldUseVectorSearch(query);
    
    let results: Array<{id: string; score: number}> = [];
    
    // Phase 1: Keyword search (fast, always enabled)
    const keywordResults = await this.executeKeywordSearch(query, options);
    
    if (!shouldUseVector || !this.config.vectorEnabled) {
      // Only keyword search
      return this.formatResults(keywordResults, 'keyword');
    }
    
    // Check timeout before expensive vector search
    const elapsed = Date.now() - startTime;
    if (elapsed >= this.config.timeoutMs) {
      console.log('Vector search timeout, using keyword-only');
      return this.formatResults(keywordResults, 'keyword');
    }
    
    // Phase 2: Vector search (semantic, optional)
    const vectorResults = await this.executeVectorSearch(query, options);
    
    // Phase 3: Merge results
    if (vectorResults.length > 0) {
      results = this.mergeResults(keywordResults, vectorResults);
    } else {
      results = keywordResults;
    }
    
    // Apply final formatting with ranking info
    return this.formatResults(results, shouldUseVector ? 'fusion' : 'keyword');
  }
  
  /**
   * Smart query routing decision
   */
  private shouldUseVectorSearch(query: string): boolean {
    // Force mode override
    if (this.config.routingStrategy === 'force-vector') return true;
    if (this.config.routingStrategy === 'force-keyword') return false;
    
    // Automatic routing based on query characteristics
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    
    // Use vector for longer, more natural queries
    if (words.length >= 4) return true;
    
    // Use vector for questions or conversational queries
    if (/^[a-z]+[?!:]$/i.test(query.trim())) return true;
    
    // Use keyword for short, specific terms
    return false;
  }
  
  /**
   * Execute keyword search via FTS5
   */
  private async executeKeywordSearch(
    query: string, 
    options: { limit?: number; project?: string }
  ): Promise<Array<{id: string; score: number}>> {
    const limit = options.limit || this.config.maxKeywordResults;
    
    if (options.project) {
      // Project-scoped search
      const indexedResults = this.index.searchByProject(options.project, query, limit);
      
      return indexedResults.map((row: any) => ({
        id: row.id,
        score: 0.8 // Base score for matched projects
      }));
    }
    
    // Global keyword search
    const indexedResults = this.index.search(query, limit);
    
    return indexedResults.map(r => ({
      id: r.memory.id,
      score: r.score
    }));
  }
  
  /**
   * Execute vector search (semantic)
   */
  private async executeVectorSearch(
    query: string,
    options: { limit?: number }
  ): Promise<Array<{id: string; score: number}>> {
    if (!this.config.vectorEnabled) return [];
    
    const limit = options.limit || this.config.maxVectorResults;
    
    try {
      const semanticResults = await this.vectorIndex.semanticSearch(query, limit);
      
      return semanticResults.map(r => ({
        id: r.memory_id,
        score: r.score
      }));
    } catch (error) {
      console.error('Vector search failed:', error);
      return [];
    }
  }
  
  /**
   * Merge results using Reciprocal Rank Fusion
   * Best method for combining different retrieval systems
   */
  private mergeResults(
    keywordResults: Array<{id: string; score: number}>,
    vectorResults: Array<{id: string; score: number}>
  ): Array<{id: string; score: number}> {
    if (keywordResults.length === 0) return vectorResults;
    if (vectorResults.length === 0) return keywordResults;
    
    // Calculate reciprocal ranks for each result
    const fusionScores = new Map<string, number>();
    
    // Add keyword scores with inverse rank weighting
    keywordResults.forEach((result, index) => {
      const rankWeight = 1 / (index + this.config.rrfK);
      const current = fusionScores.get(result.id) || 0;
      fusionScores.set(result.id, current + rankWeight);
    });
    
    // Add vector scores with inverse rank weighting
    vectorResults.forEach((result, index) => {
      const rankWeight = 1 / (index + this.config.rrfK);
      const current = fusionScores.get(result.id) || 0;
      fusionScores.set(result.id, current + rankWeight);
    });
    
    // Convert map to array and sort by fusion score
    const merged = Array.from(fusionScores.entries())
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score);
    
    return merged;
  }
  
  /**
   * Format results for client consumption
   */
  private async formatResults(
    results: Array<{id: string; score: number}>,
    source: 'keyword' | 'vector' | 'fusion'
  ): Promise<Array<{
    id: string;
    score: number;
    rank: number;
    memory: any;
    source: 'keyword' | 'vector' | 'fusion';
  }>> {
    // Fetch full memory objects for top results
    const formatted = results.slice(0, 50).map((result, index) => ({
      id: result.id,
      score: result.score,
      rank: index + 1,
      source: source as any,
      memory: { id: result.id, title: `Memory ${result.id}`, content: '...' }
    }));
    
    // Load memory details in parallel (limited batch)
    const loadMemoryDetails = async () => {
      // TODO: Implement memory loader from tiered pool
      // For now, return placeholder data
      formatted.forEach(f => {
        f.memory = { id: f.id, title: `Memory ${f.id}`, content: '...' };
      });
    };
    
    await loadMemoryDetails();
    
    return formatted;
  }
  
  /**
   * Configuration management
   */
  enableVectorSearch(): void {
    this.config.vectorEnabled = true;
    this.vectorIndex.initialize();
  }
  
  disableVectorSearch(): void {
    this.config.vectorEnabled = false;
  }
  
  getConfig(): HybridSearchConfig {
    return { ...this.config };
  }
}

export default HybridSearchRouter;
