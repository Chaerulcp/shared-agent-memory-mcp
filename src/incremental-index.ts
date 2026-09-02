/**
 * Incremental Index - Fast B-tree based indexing for memories
 * Replaces slow full-rebuild approach with efficient insert/delete operations
 */

import Database from 'better-sqlite3';

interface WriteOperation {
  type: 'insert' | 'delete' | 'update';
  id: string;
  data?: any;
  timestamp: number;
}

export class IncrementalIndex {
  private db: ReturnType<typeof Database>;
  private writeAheadLog: WriteOperation[] = [];
  private flushThreshold = 100;
  
  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = "WAL"');
    
    // Initialize indices if not exists
    this.initializeSchema();
  }
  
  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_index (
        id TEXT PRIMARY KEY,
        title TEXT,
        content_hash TEXT,
        tags TEXT,  -- JSON array
        project TEXT,
        last_accessed INTEGER,
        access_count INTEGER DEFAULT 0,
        tier TEXT DEFAULT 'warm',
        created_at INTEGER,
        updated_at INTEGER
      );
      
      CREATE INDEX IF NOT EXISTS idx_content ON memory_index(content_hash);
      CREATE INDEX IF NOT EXISTS idx_project ON memory_index(project);
      CREATE INDEX IF NOT EXISTS idx_tier ON memory_index(tier);
      CREATE INDEX IF NOT EXISTS idx_last_accessed ON memory_index(last_accessed);
      
      -- FTS5 virtual table for fast keyword search
      CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
        title, content, content='memory_index', content_rowid='rowid'
      );
      
      -- Trigger to keep FTS in sync
      CREATE TRIGGER IF NOT EXISTS memory_index_ai AFTER INSERT ON memory_index BEGIN
        INSERT INTO memory_fts(rowid, title, content) VALUES (NEW.rowid, NEW.title, NEW.content);
      END;
      
      CREATE TRIGGER IF NOT EXISTS memory_index_ad AFTER DELETE ON memory_index BEGIN
        INSERT INTO memory_fts(memory_fts, rowid, title, content) VALUES ('delete', OLD.rowid, OLD.title, OLD.content);
      END;
      
      CREATE TRIGGER IF NOT EXISTS memory_index_au AFTER UPDATE ON memory_index BEGIN
        INSERT INTO memory_fts(memory_fts, rowid, title, content) VALUES ('delete', OLD.rowid, OLD.title, OLD.content);
        INSERT INTO memory_fts(rowid, title, content) VALUES (NEW.rowid, NEW.title, NEW.content);
      END;
    `);
  }
  
  async add(memory: any): Promise<void> {
    const operation: WriteOperation = {
      type: 'insert',
      id: memory.id,
      data: memory,
      timestamp: Date.now()
    };
    
    // Add to write-ahead log
    this.writeAheadLog.push(operation);
    
    // Batch commit every N operations
    if (this.writeAheadLog.length >= this.flushThreshold) {
      await this.flushWriteAhead();
    }
  }
  
  async delete(id: string): Promise<void> {
    this.writeAheadLog.push({
      type: 'delete',
      id,
      timestamp: Date.now()
    });
    
    if (this.writeAheadLog.length >= this.flushThreshold) {
      await this.flushWriteAhead();
    }
  }
  
  async update(id: string, updates: Partial<any>): Promise<void> {
    this.writeAheadLog.push({
      type: 'update',
      id,
      data: updates,
      timestamp: Date.now()
    });
    
    if (this.writeAheadLog.length >= this.flushThreshold) {
      await this.flushWriteAhead();
    }
  }
  
  private async flushWriteAhead(): Promise<void> {
    if (this.writeAheadLog.length === 0) return;
    
    const tx = this.db.transaction(() => {
      for (const op of this.writeAheadLog) {
        switch (op.type) {
          case 'insert':
            this.db.prepare(`
              INSERT OR REPLACE INTO memory_index (
                id, title, content_hash, tags, project, 
                last_accessed, access_count, tier, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              op.data.id,
              op.data.title || '',
              op.data.hash || this.computeHash(op.data.content),
              JSON.stringify(op.data.tags || []),
              op.data.project || null,
              Date.now(),
              0,
              'warm',
              Date.now(),
              Date.now()
            );
            break;
            
          case 'delete':
            this.db.prepare('DELETE FROM memory_index WHERE id = ?').run(op.id);
            break;
            
          case 'update':
            const updateFields: string[] = [];
            const params: any[] = [];
            
            if (op.data.title !== undefined) {
              updateFields.push('title = ?');
              params.push(op.data.title);
            }
            if (op.data.project !== undefined) {
              updateFields.push('project = ?');
              params.push(op.data.project);
            }
            if (op.data.tags !== undefined) {
              updateFields.push('tags = ?');
              params.push(JSON.stringify(op.data.tags));
            }
            
            if (updateFields.length > 0) {
              params.push(Date.now());
              params.push(op.id);
              this.db.prepare(
                `UPDATE memory_index SET ${updateFields.join(', ')}, updated_at = ? WHERE id = ?`
              ).run(...params);
            }
            break;
        }
      }
    });
    
    try {
      tx();
      this.writeAheadLog = [];
    } catch (error) {
      console.error('Flush failed:', error);
      throw error;
    }
  }
  
  search(query: string, limit = 20): Array<{id: string; score: number; memory: any}> {
    // Use FTS5 for keyword matching
    const stmt = this.db.prepare(`
      SELECT m.* FROM memory_fts mfts
      JOIN memory_index m ON mfts.rowid = m.rowid
      WHERE memory_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `);
    
    const results = stmt.all(query, limit);
    
    return results.map((row: any) => ({
      id: row.id,
      score: 0.9, // FTS rank gives high confidence
      memory: {
        id: row.id,
        title: row.title,
        content: row.content,
        tags: JSON.parse(row.tags),
        project: row.project,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    }));
  }
  
  searchByProject(project: string, query?: string, limit = 20): Array<any> {
    let sql = 'SELECT * FROM memory_index WHERE project = ? AND tier = \'warm\'';
    const params: any[] = [project];
    
    if (query) {
      sql += ' AND (title MATCH ? OR content MATCH ?)';
      params.push(query, query);
    }
    
    sql += ' ORDER BY last_accessed DESC LIMIT ?';
    params.push(limit);
    
    return this.db.prepare(sql).all(...params);
  }
  
  promoteToHot(id: string): void {
    this.db.prepare(`
      UPDATE memory_index SET tier = 'hot', last_accessed = ?, access_count = access_count + 1 WHERE id = ?
    `).run(Date.now(), id);
  }
  
  demoteFromHot(limit = 10): void {
    // Demote least accessed hot memories to warm
    this.db.prepare(`
      UPDATE memory_index SET tier = 'warm' 
      WHERE tier = 'hot' 
      ORDER BY last_accessed ASC 
      LIMIT ?
    `).run(limit);
  }
  
  getHotMemoryIds(): string[] {
    const rows = this.db.prepare('SELECT id FROM memory_index WHERE tier = \'hot\'').all();
    return rows.map((r: any) => r.id);
  }
  
  private computeHash(content: string): string {
    // Simple hash for deduplication check
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }
  
  close(): void {
    // Force flush remaining operations
    if (this.writeAheadLog.length > 0) {
      this.flushWriteAhead();
    }
    this.db.close();
  }
}

export default IncrementalIndex;
