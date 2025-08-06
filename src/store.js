// Force TensorFlow.js backend - no more ONNX dependencies!
import { getEmbeddingPipeline } from './tensorflow-embeddings.js';
import fs from 'fs';
import lancedb from '@lancedb/lancedb';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import * as arrow from 'apache-arrow';

// Current embedding model identifier
const CURRENT_EMBEDDING_MODEL = 'tensorflow/universal-sentence-encoder@3.3.0';

// Get the current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple Headers polyfill for Node.js
if (!globalThis.Headers) {
    globalThis.Headers = class Headers {
        constructor(init = {}) {
            this._headers = new Map();
            if (init) {
                if (typeof init === 'object') {
                    for (const [key, value] of Object.entries(init)) {
                        this._headers.set(key.toLowerCase(), String(value));
                    }
                }
            }
        }
        
        get(name) {
            return this._headers.get(name.toLowerCase()) || null;
        }
        
        set(name, value) {
            this._headers.set(name.toLowerCase(), String(value));
        }
        
        has(name) {
            return this._headers.has(name.toLowerCase());
        }
        
        delete(name) {
            this._headers.delete(name.toLowerCase());
        }
        
        forEach(callback) {
            this._headers.forEach((value, key) => callback(value, key, this));
        }
        
        *[Symbol.iterator]() {
            for (const [key, value] of this._headers) {
                yield [key, value];
            }
        }
    };
}

export function get_config_path(userDataPath) {
    return path.join(userDataPath, 'config.json');
}

export async function initializeDatabase(configPath, dialog, app) {
  let config = {};
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath));
  }

  let db;
  while (true) {
    if (!config.storage_path) {
      // Use application user data directory by default
      const defaultStoragePath = path.join(app.getPath('userData'), 'database');
      
      // Create the directory if it doesn't exist
      if (!fs.existsSync(defaultStoragePath)) {
        fs.mkdirSync(defaultStoragePath, { recursive: true });
      }
      
      config.storage_path = defaultStoragePath;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }

    try {
      db = await lancedb.connect(config.storage_path);
      const tables = await db.tableNames();
      
      // Initialize raw items table (backup/export source)
      if (!tables.includes('items_raw')) {
        const sampleRawData = [{
          id: 'sample',
          type: 'text',
          payload: 'sample payload',
          description: 'sample description',
          created_at: new Date().toISOString(),
          last_accessed_at: new Date().toISOString(),
        }];
        
        const rawTable = await db.createTable('items_raw', sampleRawData);
        await rawTable.delete('id = "sample"');
      }
      
      // Initialize embeddings table
      if (!tables.includes('items_embeddings')) {
        const sampleEmbeddingData = [{
          id: 'sample',
          embedding_model: CURRENT_EMBEDDING_MODEL,
          vector: new Array(512).fill(0.0),
          created_at: new Date().toISOString(),
        }];
        
        const embeddingTable = await db.createTable('items_embeddings', sampleEmbeddingData);
        await embeddingTable.delete('id = "sample"');
      }
      
      // Legacy: Keep old 'items' table for backward compatibility, but migrate data
      if (tables.includes('items')) {
        await migrateLegacyData(db);
      }
      
      break; // Success, exit loop
    } catch (err) {
      console.error('Error initializing database:', err);
      const { response } = await dialog.showMessageBox({
        type: 'error',
        title: 'Database Error',
        message: `Could not initialize the database at ${config.storage_path}. Please check permissions or try restarting the application.`,
        buttons: ['Quit', 'Retry'],
      });

      if (response === 1) { // Retry
        continue;
      } else {
        app.quit();
        return;
      }
    }
  }
}

/**
 * Migrate data from legacy 'items' table to new split architecture
 */
async function migrateLegacyData(db) {
  try {
    console.log('Migrating legacy data to new architecture...');
    const legacyTable = await db.openTable('items');
    const legacyItems = await legacyTable.query().toArray();
    
    if (legacyItems.length === 0) {
      console.log('No legacy data to migrate');
      return;
    }
    
    const rawTable = await db.openTable('items_raw');
    const embeddingTable = await db.openTable('items_embeddings');
    
    for (const item of legacyItems) {
      // Check if already migrated
      const existingRaw = await rawTable.query().where(`id = "${item.id}"`).toArray();
      if (existingRaw.length > 0) continue;
      
      // Add to raw table
      await rawTable.add([{
        id: item.id,
        type: item.type,
        payload: item.payload,
        description: item.description,
        created_at: item.created_at,
        last_accessed_at: item.last_accessed_at,
      }]);
      
      // Convert vector to regular array if it's a Float32Array or similar
      let vectorArray = item.vector;
      if (vectorArray && typeof vectorArray === 'object' && vectorArray.length !== undefined) {
        vectorArray = Array.from(vectorArray);
      }
      
      // Add to embeddings table
      await embeddingTable.add([{
        id: item.id,
        embedding_model: item.embedding_model || 'tensorflow/universal-sentence-encoder',
        vector: vectorArray || new Array(512).fill(0.0),
        created_at: item.created_at,
      }]);
    }
    
    console.log(`Migrated ${legacyItems.length} items to new architecture`);
    
    // Don't drop legacy table immediately - keep it as backup for now
    console.log('Legacy table preserved as backup');
  } catch (error) {
    console.error('Error migrating legacy data:', error);
    // Don't throw - let the app continue with legacy table if migration fails
  }
}

/**
 * Get current embedding model identifier
 */
export function getCurrentEmbeddingModel() {
  return CURRENT_EMBEDDING_MODEL;
}

/**
 * Check if embedding needs regeneration and regenerate if necessary
 */
async function ensureEmbeddingCurrent(itemId, db) {
  try {
    const embeddingTable = await db.openTable('items_embeddings');
    const embeddings = await embeddingTable.query().where(`id = "${itemId}"`).toArray();
    
    if (embeddings.length === 0) return null;
    
    const embedding = embeddings[0];
    if (embedding.embedding_model !== CURRENT_EMBEDDING_MODEL) {
      console.log(`Regenerating embedding for item ${itemId}: ${embedding.embedding_model} -> ${CURRENT_EMBEDDING_MODEL}`);
      
      // Get raw data
      const rawTable = await db.openTable('items_raw');
      const rawItems = await rawTable.query().where(`id = "${itemId}"`).toArray();
      
      if (rawItems.length === 0) {
        console.error(`No raw data found for item ${itemId}`);
        return embedding.vector;
      }
      
      const rawItem = rawItems[0];
      const newEmbedding = await generateEmbedding(rawItem.payload + ' ' + rawItem.description);
      
      // Update embedding
      await embeddingTable.delete(`id = "${itemId}"`);
      await embeddingTable.add([{
        id: itemId,
        embedding_model: CURRENT_EMBEDDING_MODEL,
        vector: newEmbedding,
        created_at: new Date().toISOString(),
      }]);
      
      return newEmbedding;
    }
    
    return embedding.vector;
  } catch (error) {
    console.error('Error ensuring embedding current:', error);
    return null;
  }
}

/**
 * Generate embeddings for text using Universal Sentence Encoder
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} Embedding vector
 */
async function generateEmbedding(text) {
    const pipeline = await getEmbeddingPipeline();
    return await pipeline.generateEmbedding(text);
}

export async function addItem(item, configPath) {
  try {
    const itemId = uuidv4();
    const now = new Date().toISOString();
    const embedding = await generateEmbedding(item.payload + ' ' + item.description);

    const config = JSON.parse(fs.readFileSync(configPath));
    const db = await lancedb.connect(config.storage_path);
    
    // Add to raw table (backup/export source)
    const rawTable = await db.openTable('items_raw');
    await rawTable.add([{
      id: itemId,
      type: item.type,
      payload: item.payload,
      description: item.description,
      created_at: now,
      last_accessed_at: now,
    }]);
    
    // Add to embeddings table
    const embeddingTable = await db.openTable('items_embeddings');
    await embeddingTable.add([{
      id: itemId,
      embedding_model: CURRENT_EMBEDDING_MODEL,
      vector: embedding,
      created_at: now,
    }]);
    
  } catch (error) {
    console.error('Detailed error in addItem:', error);
    console.error('Error stack:', error.stack);
    throw new Error(`Failed to add item: ${error.message}`);
  }
}

export async function searchItems(query, configPath) {
  const config = JSON.parse(fs.readFileSync(configPath));
  const db = await lancedb.connect(config.storage_path);

  if (!query) {
    return [];
  }

  try {
    const queryEmbedding = await generateEmbedding(query);

    // Join raw data with embeddings for search
    const rawTable = await db.openTable('items_raw');
    const embeddingTable = await db.openTable('items_embeddings');

    // Get all raw items that match text search
    const searchPattern = query.toLowerCase();
    const rawResults = await rawTable
      .query()
      .where(`LOWER(description) LIKE '%${searchPattern}%' OR LOWER(payload) LIKE '%${searchPattern}%'`)
      .toArray();

    // For each result, get/update embedding and calculate similarity
    const results = [];
    for (const rawItem of rawResults) {
      await ensureEmbeddingCurrent(rawItem.id, db);
      
      const embeddings = await embeddingTable.query().where(`id = "${rawItem.id}"`).toArray();
      if (embeddings.length > 0) {
        results.push({
          ...rawItem,
          embedding_model: embeddings[0].embedding_model,
        });
      }
    }

    // Also do vector search on embeddings
    const vectorResults = await embeddingTable
      .search(queryEmbedding)
      .limit(10)
      .toArray();

    // Combine and deduplicate results
    const allResults = new Map();
    
    // Add text search results
    results.forEach(item => allResults.set(item.id, item));
    
    // Add vector search results
    for (const vectorResult of vectorResults) {
      if (!allResults.has(vectorResult.id)) {
        const rawItems = await rawTable.query().where(`id = "${vectorResult.id}"`).toArray();
        if (rawItems.length > 0) {
          allResults.set(vectorResult.id, {
            ...rawItems[0],
            embedding_model: vectorResult.embedding_model,
          });
        }
      }
    }

    return Array.from(allResults.values()).slice(0, 10);
  } catch (error) {
    console.error('Detailed error in searchItems:', error);
    console.error('Error stack:', error.stack);
    throw new Error(`Failed to search items: ${error.message}`);
  }
}

export async function getRecentItems(configPath) {
  const config = JSON.parse(fs.readFileSync(configPath));
  const db = await lancedb.connect(config.storage_path);
  const tables = await db.tableNames();
  
  // Check if we have the new architecture
  if (tables.includes('items_raw') && tables.includes('items_embeddings')) {
    const rawTable = await db.openTable('items_raw');
    const embeddingTable = await db.openTable('items_embeddings');

    const items = await rawTable.query().toArray();
    
    // If no items in new tables but legacy table exists, try migration again
    if (items.length === 0 && tables.includes('items')) {
      await migrateLegacyData(db);
      // Retry after migration
      const itemsAfterMigration = await rawTable.query().toArray();
      if (itemsAfterMigration.length === 0) {
        // Fallback to legacy table
        return await getLegacyRecentItems(db);
      }
    }
    
    // Ensure embeddings are current for recent items
    const recentItems = items
      .sort((a, b) => new Date(b.last_accessed_at) - new Date(a.last_accessed_at))
      .slice(0, 5);
      
    const results = [];
    for (const item of recentItems) {
      await ensureEmbeddingCurrent(item.id, db);
      const embeddings = await embeddingTable.query().where(`id = "${item.id}"`).toArray();
      results.push({
        ...item,
        embedding_model: embeddings.length > 0 ? embeddings[0].embedding_model : 'unknown',
      });
    }

    return results;
  } else {
    // Fallback to legacy table
    return await getLegacyRecentItems(db);
  }
}

/**
 * Fallback function to read from legacy table
 */
async function getLegacyRecentItems(db) {
  try {
    const tables = await db.tableNames();
    if (!tables.includes('items')) return [];
    
    const table = await db.openTable('items');
    const items = await table
      .query()
      .select([
        'id',
        'type',
        'payload',
        'description',
        'created_at',
        'last_accessed_at',
        'embedding_model',
      ])
      .toArray();

    return items
      .sort((a, b) => new Date(b.last_accessed_at) - new Date(a.last_accessed_at))
      .slice(0, 5)
      .map(({ vector, ...rest }) => rest);
  } catch (error) {
    console.error('Error reading from legacy table:', error);
    return [];
  }
}

export async function deleteItem(itemId, configPath) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath));
    const db = await lancedb.connect(config.storage_path);
    
    // Delete from both tables
    const rawTable = await db.openTable('items_raw');
    const embeddingTable = await db.openTable('items_embeddings');
    
    await rawTable.delete(`id = "${itemId}"`);
    await embeddingTable.delete(`id = "${itemId}"`);
  } catch (error) {
    console.error('Detailed error in deleteItem:', error);
    console.error('Error stack:', error.stack);
    throw new Error(`Failed to delete item: ${error.message}`);
  }
}

export async function getAllItems(configPath) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath));
    const db = await lancedb.connect(config.storage_path);
    const tables = await db.tableNames();
    
    // Check if we have the new architecture
    if (tables.includes('items_raw') && tables.includes('items_embeddings')) {
      const rawTable = await db.openTable('items_raw');
      const embeddingTable = await db.openTable('items_embeddings');

      const items = await rawTable.query().toArray();
      
      // If no items in new tables but legacy table exists, try migration again
      if (items.length === 0 && tables.includes('items')) {
        await migrateLegacyData(db);
        // Retry after migration
        const itemsAfterMigration = await rawTable.query().toArray();
        if (itemsAfterMigration.length === 0) {
          // Fallback to legacy table
          return await getLegacyAllItems(db);
        }
      }
      
      const results = [];
      for (const item of items) {
        await ensureEmbeddingCurrent(item.id, db);
        const embeddings = await embeddingTable.query().where(`id = "${item.id}"`).toArray();
        results.push({
          ...item,
          embedding_model: embeddings.length > 0 ? embeddings[0].embedding_model : 'unknown',
        });
      }

      return results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else {
      // Fallback to legacy table
      return await getLegacyAllItems(db);
    }
  } catch (error) {
    console.error('Detailed error in getAllItems:', error);
    console.error('Error stack:', error.stack);
    throw new Error(`Failed to get all items: ${error.message}`);
  }
}

/**
 * Fallback function to read all items from legacy table
 */
async function getLegacyAllItems(db) {
  try {
    const tables = await db.tableNames();
    if (!tables.includes('items')) return [];
    
    const table = await db.openTable('items');
    const items = await table
      .query()
      .select([
        'id',
        'type',
        'payload',
        'description',
        'created_at',
        'last_accessed_at',
        'embedding_model',
      ])
      .toArray();

    return items
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(({ vector, ...rest }) => rest);
  } catch (error) {
    console.error('Error reading all items from legacy table:', error);
    return [];
  }
}

export async function exportData(configPath, format = 'json') {
  try {
    // Export from raw table - this is the clean backup data
    const config = JSON.parse(fs.readFileSync(configPath));
    const db = await lancedb.connect(config.storage_path);
    const rawTable = await db.openTable('items_raw');
    const items = await rawTable.query().toArray();
    
    const sortedItems = items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    if (format === 'csv') {
      // Convert to CSV format
      const headers = ['id', 'type', 'description', 'payload', 'created_at', 'last_accessed_at'];
      const csvRows = [
        headers.join(','),
        ...sortedItems.map(item => 
          headers.map(header => {
            const value = item[header] || '';
            // Escape quotes and wrap in quotes if contains comma or quote
            return typeof value === 'string' && (value.includes(',') || value.includes('"'))
              ? `"${value.replace(/"/g, '""')}"` 
              : value;
          }).join(',')
        )
      ];
      return csvRows.join('\n');
    } else {
      // Default to JSON format
      return JSON.stringify(sortedItems, null, 2);
    }
  } catch (error) {
    console.error('Detailed error in exportData:', error);
    console.error('Error stack:', error.stack);
    throw new Error(`Failed to export data: ${error.message}`);
  }
}

export function getDataPath(configPath) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath));
    return config.storage_path;
  } catch (error) {
    return null;
  }
}

export async function importData(configPath, importData, format = 'json') {
  try {
    let items = [];
    
    if (format === 'csv') {
      // Parse CSV data
      const lines = importData.trim().split('\n');
      if (lines.length < 2) {
        throw new Error('CSV file must contain at least a header row and one data row');
      }
      
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const requiredFields = ['type', 'description', 'payload'];
      
      for (const field of requiredFields) {
        if (!headers.includes(field)) {
          throw new Error(`CSV file must contain required field: ${field}`);
        }
      }
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const item = {};
        
        headers.forEach((header, index) => {
          if (values[index] !== undefined) {
            item[header] = values[index];
          }
        });
        
        // Validate required fields
        for (const field of requiredFields) {
          if (!item[field] || item[field].trim() === '') {
            throw new Error(`Row ${i + 1}: Missing required field '${field}'`);
          }
        }
        
        items.push(item);
      }
    } else {
      // Parse JSON data
      const parsedData = JSON.parse(importData);
      items = Array.isArray(parsedData) ? parsedData : [parsedData];
      
      // Validate each item has required fields
      const requiredFields = ['type', 'description', 'payload'];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        for (const field of requiredFields) {
          if (!item[field] || (typeof item[field] === 'string' && item[field].trim() === '')) {
            throw new Error(`Item ${i + 1}: Missing required field '${field}'`);
          }
        }
      }
    }
    
    // Import each item using the new architecture
    const config = JSON.parse(fs.readFileSync(configPath));
    const db = await lancedb.connect(config.storage_path);
    const rawTable = await db.openTable('items_raw');
    const embeddingTable = await db.openTable('items_embeddings');
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i];
        const itemId = item.id || uuidv4(); // Use existing ID if provided
        const now = new Date().toISOString();
        const embedding = await generateEmbedding(item.payload + ' ' + item.description);
        
        // Add to raw table
        await rawTable.add([{
          id: itemId,
          type: item.type,
          payload: item.payload,
          description: item.description,
          created_at: item.created_at || now,
          last_accessed_at: item.last_accessed_at || now,
        }]);
        
        // Add to embeddings table
        await embeddingTable.add([{
          id: itemId,
          embedding_model: CURRENT_EMBEDDING_MODEL,
          vector: embedding,
          created_at: now,
        }]);
        
        successCount++;
      } catch (error) {
        errorCount++;
        errors.push(`Item ${i + 1}: ${error.message}`);
        console.error(`Error importing item ${i + 1}:`, error);
      }
    }
    
    return {
      success: true,
      message: `Import completed: ${successCount} items imported successfully${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
      successCount,
      errorCount,
      errors: errorCount > 0 ? errors : undefined
    };
    
  } catch (error) {
    console.error('Detailed error in importData:', error);
    console.error('Error stack:', error.stack);
    throw new Error(`Failed to import data: ${error.message}`);
  }
}

export async function deleteAllData(configPath) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath));
    const db = await lancedb.connect(config.storage_path);
    
    // Drop both tables and recreate them
    await db.dropTable('items_raw');
    await db.dropTable('items_embeddings');
    
    // Recreate raw table
    const sampleRawData = [{
      id: 'sample',
      type: 'text',
      payload: 'sample payload',
      description: 'sample description',
      created_at: new Date().toISOString(),
      last_accessed_at: new Date().toISOString(),
    }];
    
    const rawTable = await db.createTable('items_raw', sampleRawData);
    await rawTable.delete('id = "sample"');
    
    // Recreate embeddings table
    const sampleEmbeddingData = [{
      id: 'sample',
      embedding_model: CURRENT_EMBEDDING_MODEL,
      vector: new Array(512).fill(0.0),
      created_at: new Date().toISOString(),
    }];
    
    const embeddingTable = await db.createTable('items_embeddings', sampleEmbeddingData);
    await embeddingTable.delete('id = "sample"');
    
    return { success: true, message: 'All data deleted successfully' };
  } catch (error) {
    console.error('Detailed error in deleteAllData:', error);
    console.error('Error stack:', error.stack);
    throw new Error(`Failed to delete all data: ${error.message}`);
  }
}

/**
 * Force regenerate all embeddings with current model (for testing)
 */
export async function regenerateAllEmbeddings(configPath) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath));
    const db = await lancedb.connect(config.storage_path);
    const rawTable = await db.openTable('items_raw');
    const embeddingTable = await db.openTable('items_embeddings');
    
    const allItems = await rawTable.query().toArray();
    
    let regeneratedCount = 0;
    
    for (const item of allItems) {
      try {
        const newEmbedding = await generateEmbedding(item.payload + ' ' + item.description);
        
        // Remove old embedding
        await embeddingTable.delete(`id = "${item.id}"`);
        
        // Add new embedding
        await embeddingTable.add([{
          id: item.id,
          embedding_model: CURRENT_EMBEDDING_MODEL,
          vector: newEmbedding,
          created_at: new Date().toISOString(),
        }]);
        
        regeneratedCount++;
      } catch (error) {
        console.error(`Error regenerating embedding for item ${item.id}:`, error);
      }
    }
    
    return {
      success: true,
      message: `Regenerated ${regeneratedCount} embeddings with model ${CURRENT_EMBEDDING_MODEL}`,
      regeneratedCount,
      totalItems: allItems.length,
    };
  } catch (error) {
    console.error('Detailed error in regenerateAllEmbeddings:', error);
    console.error('Error stack:', error.stack);
    throw new Error(`Failed to regenerate embeddings: ${error.message}`);
  }
}
