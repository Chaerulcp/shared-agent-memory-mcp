/**
 * Vector Search Support - MOVED TO MOCK IMPLEMENTATION FOR TESTING
 * 
 * NOTE: Full vector search with ONNX Runtime requires:
 * 1. Download sentence-transformers model from HuggingFace
 * 2. Convert to ONNX format
 * 3. Install proper native dependencies for Windows
 * 
 * For now, this uses hash-based mock embeddings for demonstration purposes.
 */

import Database from 'better-sqlite3';

interface EmbeddingConfig {
  model: string;
  dimension: number;
  enabled: boolean;
  lazyLoad: boolean;
}

export class VectorSearchIndex {
  private db: Database.Database;
  private config: EmbeddingConfig;
  private initialized: boolean = false;
  private embeddingCache: Map<string, number[]> = new Map();
  
  constructor(dbPath: string, config: Partial<EmbeddingConfig> = {}) {
    this.config = {
      model: 'all-MiniLM-L6-v2',
      dimension: 384,
      enabled: false,
      lazyLoad: true,
      ...config
    };
    
    this.db = new Database(dbPath);
  }
  
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Create mock metadata tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS embedding_metadata (
        memory_id TEXT PRIMARY KEY,
        content TEXT,
        created_at INTEGER,
        access_count INTEGER DEFAULT 0
      );
      
      CREATE TABLE IF NOT EXISTS embedding_index (
        memory_id TEXT PRIMARY KEY,
        embedding_id INTEGER
      );
    `);
    
    this.initialized = true;
    console.log('✅ Vector search initialized (mock mode)');
    console.log('💡 Mock embeddings are deterministic based on content hash');
    console.log('💡 Real semantic embeddings require ONNX Runtime setup');
  }
  
  /**
   * Generate deterministic mock embedding based on content hash
   * This simulates what a real embedding would look like
   */
  async generateEmbedding(content: string): Promise<number[] | null> {
    if (!this.config.enabled) return null;
    
    if (this.embeddingCache.has(content)) {
      return this.embeddingCache.get(content)!;
    }
    
    // Deterministic hash-based generation
    const embedding = this.generateMockEmbedding(content);
    this.embeddingCache.set(content, embedding);
    return embedding;
  }
  
  private generateMockEmbedding(content: string): number[] {
    const embedding = new Array(this.config.dimension).fill(0);
    
    // Create consistent vectors for same content
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) - hash) + content.charCodeAt(i);
      hash = hash & hash;
    }
    
    // Generate pseudo-random values
    for (let i = 0; i < this.config.dimension; i++) {
      const tempHash = ((hash * (i + 1)) ^ (hash >> 3)) & 0xFFFFFFFF;
      embedding[i] = (tempHash / 0xFFFFFFFF) * 2 - 1;
    }
    
    return embedding;
  }
  
  async insertWithEmbedding(memoryId: string, content: string): Promise<void> {
    if (!this.config.enabled) return;
    
    if (!this.initialized) {
      await this.initialize();
    }
    
    const embedding = await this.generateEmbedding(content);
    if (!embedding) return;
    
    const transaction = this.db.transaction(() => {
      this.db.prepare(`
        INSERT OR REPLACE INTO embedding_metadata (memory_id, content, created_at)
        VALUES (?, ?, ?)
      `).run(memoryId, content, Date.now());
      
      this.db.prepare(`
        INSERT OR REPLACE INTO embedding_index (memory_id, embedding_id)
        VALUES (?, ?)
      `).run(memoryId, Math.floor(Math.random() * 10000));
    });
    
    transaction();
  }
  
  /**
   * Mock semantic search - returns results based on keyword matching
   * In production with real embeddings, this would use cosine similarity
   */
  async semanticSearch(query: string, limit = 20): Promise<Array<{
    memory_id: string;
    content: string;
    score: number;
  }>> {
    if (!this.config.enabled) return [];
    
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Get query embedding
    const queryEmbedding = await this.generateEmbedding(query);
    if (!queryEmbedding) return [];
    
    // Fetch all stored embeddings for comparison
    const allData = this.db.prepare(`
      SELECT ei.memory_id, em.content 
      FROM embedding_index ei
      JOIN embedding_metadata em ON ei.memory_id = em.memory_id
    `).all() as Array<{memory_id: string; content: string}>;
    
    if (allData.length === 0) {
      return [];
    }
    
    // Calculate similarity scores using mock embeddings
    const results = allData.map(item => {
      const itemEmbedding = this.generateMockEmbedding(item.content);
      
      // Cosine similarity calculation
      let dotProduct = 0;
      let normQuery = 0;
      let normItem = 0;
      
      for (let i = 0; i < this.config.dimension; i++) {
        dotProduct += queryEmbedding[i] * itemEmbedding[i];
        normQuery += queryEmbedding[i] * queryEmbedding[i];
        normItem += itemEmbedding[i] * itemEmbedding[i];
      }
      
      const similarity = dotProduct / (Math.sqrt(normQuery) * Math.sqrt(normItem));
      
      return {
        memory_id: item.memory_id,
        content: item.content,
        score: similarity
      };
    });
    
    // Sort by similarity and limit
    return results
      .filter(r => r.score > 0.1) // Only significant matches
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  
  async batchProcessMemories(memories: Array<{id: string; content: string}>): Promise<void> {
    if (!this.config.enabled) return;
    
    if (!this.initialized) {
      await this.initialize();
    }
    
    console.log(`🔄 Processing ${memories.length} memories...`);
    
    let success = 0;
    for (const memory of memories) {
      try {
        await this.insertWithEmbedding(memory.id, memory.content);
        success++;
      } catch (error) {
        console.error(`Failed to embed ${memory.id}:`, error);
      }
    }
    
    console.log(`✅ Processed ${success}/${memories.length} memories`);
  }
  
  cleanupStaleEmbeddings(retentionDays: number = 90): void {
    if (!this.config.enabled) return;
    
    const cutoffDate = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    this.db.prepare('DELETE FROM embedding_metadata WHERE created_at < ?').run(cutoffDate);
  }
  
  getStats(): {
    totalEmbeddings: number;
    cachedEmbeddings: number;
    averageAccessCount: number;
  } {
    const stats = this.db.prepare(`
      SELECT COUNT(*) as total, AVG(access_count) as avg_access
      FROM embedding_metadata
    `).get() as {total: number; avg_access: number};
    
    return {
      totalEmbeddings: stats.total,
      cachedEmbeddings: this.embeddingCache.size,
      averageAccessCount: stats.avg_access || 0
    };
  }
  
  close(): void {
    this.db.close();
  }
}

export default VectorSearchIndex;
