// Hybrid embedding system - supports both lightweight and TensorFlow models
import { embeddingManager, EMBEDDING_MODELS } from './hybrid-embeddings.js';
import fs from 'fs';
import lancedb from '@lancedb/lancedb';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import * as arrow from 'apache-arrow';

// Initialize embedding system
let isEmbeddingInitialized = false;

// Get the current directory for ES modules (lazy initialization for tests)
let __filename;
let __dirname;

function initializePaths() {
  if (!__filename) {
    __filename = fileURLToPath(import.meta.url);
    __dirname = path.dirname(__filename);
  }
  return { __filename, __dirname };
}

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
    console.log('📄 Loading existing config from:', configPath);
    config = JSON.parse(fs.readFileSync(configPath));
  }

  let db;
  while (true) {
    if (!config.storage_path) {
      // Use application user data directory by default
      const defaultStoragePath = path.join(app.getPath('userData'), 'database');
      console.log('📁 Setting up database at:', defaultStoragePath);
      
      // Create the directory if it doesn't exist
      if (!fs.existsSync(defaultStoragePath)) {
        fs.mkdirSync(defaultStoragePath, { recursive: true });
      }
      
      config.storage_path = defaultStoragePath;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } else {
      console.log('📁 Using existing database at:', config.storage_path);
    }

    try {
      console.log('🔌 Connecting to LanceDB...');
      db = await lancedb.connect(config.storage_path);
      console.log('✅ LanceDB connected successfully');
      
      const tables = await db.tableNames();
      console.log('📋 Existing tables:', tables);
      
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
        console.log('✅ items_raw table created');
      } else {
        console.log('✅ items_raw table already exists');
      }
      
      // Initialize embeddings table
      if (!tables.includes('items_embeddings')) {
        const sampleEmbeddingData = [{
          id: 'sample',
          embedding_model: getCurrentEmbeddingModel(),
          vector: createZeroVector(),
          created_at: new Date().toISOString(),
        }];
        
        const embeddingTable = await db.createTable('items_embeddings', sampleEmbeddingData);
        await embeddingTable.delete('id = "sample"');
        console.log('✅ items_embeddings table created');
      } else {
        console.log('✅ items_embeddings table already exists');
      }
      
      // Legacy: Keep old 'items' table for backward compatibility, but migrate data
      if (tables.includes('items')) {
        await migrateLegacyData(db);
      } else {
        console.log('ℹ️ No legacy data to migrate');
      }
      
      console.log('🎉 Database initialization completed successfully!');
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
        vector: vectorArray || createZeroVector(), // Use current model dimensions
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
  const modelType = embeddingManager.getCurrentModelType();
  return modelType === EMBEDDING_MODELS.TENSORFLOW ? 
    'tensorflow/universal-sentence-encoder@3.3.0' : 
    'lightweight-embeddings@1.0.0';
}

/**
 * Get current vector dimensions based on the active model
 */
function getCurrentDimensions() {
  return embeddingManager.getCurrentDimensions();
}

/**
 * Create a zero vector with appropriate dimensions for current model
 */
function createZeroVector() {
  return new Array(getCurrentDimensions()).fill(0.0);
}

/**
 * Check if embedding needs regeneration and regenerate if necessary
 */
async function ensureEmbeddingCurrent(itemId, db, configPath = null) {
  try {
    const embeddingTable = await db.openTable('items_embeddings');
    const embeddings = await embeddingTable.query().where(`id = "${itemId}"`).toArray();
    
    if (embeddings.length === 0) return null;
    
    const embedding = embeddings[0];
    const currentModel = getCurrentEmbeddingModel();
    if (embedding.embedding_model !== currentModel) {
      console.log(`Regenerating embedding for item ${itemId}: ${embedding.embedding_model} -> ${currentModel}`);
      
      // Get raw data
      const rawTable = await db.openTable('items_raw');
      const rawItems = await rawTable.query().where(`id = "${itemId}"`).toArray();
      
      if (rawItems.length === 0) {
        console.error(`No raw data found for item ${itemId}`);
        return embedding.vector;
      }
      
      const rawItem = rawItems[0];
      const newEmbedding = await generateEmbedding(rawItem.payload + ' ' + rawItem.description, db, configPath);
      
      // Try to update embedding safely
      try {
        await embeddingTable.delete(`id = "${itemId}"`);
        await embeddingTable.add([{
          id: itemId,
          embedding_model: currentModel,
          vector: newEmbedding,
          created_at: new Date().toISOString(),
        }]);
        return newEmbedding;
      } catch (deleteError) {
        console.warn(`Could not update embedding for item ${itemId}:`, deleteError.message);
        // Return existing embedding on update failure to prevent corruption cascade
        return embedding.vector;
      }
    }
    
    return embedding.vector;
  } catch (error) {
    console.error(`Error ensuring embedding current for ${itemId}:`, error);
    
    // Check if this is a corruption error
    if (error.message.includes('Object at location') && error.message.includes('not found')) {
      console.warn('Database corruption detected for individual item, skipping embedding update');
      // Instead of rebuilding the entire table for one item, just skip it
      // The rebuild should be triggered manually or by a separate maintenance function
      return null;
    }
    
    return null;
  }
}

/**
 * Ensure embedding system is initialized
 */
async function ensureEmbeddingInitialized() {
  if (!isEmbeddingInitialized) {
    await embeddingManager.initialize();
    isEmbeddingInitialized = true;
  }
}

/**
 * Check if embeddings table has correct model and dimensions, rebuild if different
 */
async function ensureEmbeddingTableCompatible(db, configPath) {
  // Skip if already rebuilding to avoid race conditions
  if (globalThis.isRebuilding) {
    console.log('⏳ Rebuild already in progress, skipping...');
    return;
  }

  try {
    const embeddingTable = await db.openTable('items_embeddings');
    const sampleEmbeddings = await embeddingTable.query().limit(1).toArray();
    
    if (sampleEmbeddings.length > 0) {
      const currentModel = getCurrentEmbeddingModel();
      const currentDims = getCurrentDimensions();
      
      const existingModel = sampleEmbeddings[0].embedding_model;
      const existingDims = sampleEmbeddings[0].vector ? sampleEmbeddings[0].vector.length : 0;
      
      // If model changed OR dimensions changed → nuclear rebuild
      if (existingModel !== currentModel || existingDims !== currentDims) {
        console.warn(`Model/dimension change detected: ${existingModel}(${existingDims}d) → ${currentModel}(${currentDims}d). Nuclear rebuild required.`);
        await nuclearRebuildEmbeddings(db, configPath);
        return;
      }
    }
  } catch (error) {
    console.error('Error checking embedding table compatibility, performing nuclear rebuild:', error);
    // If there's any corruption, nuclear rebuild
    await nuclearRebuildEmbeddings(db, configPath);
  }
}

/**
 * Nuclear option: Completely rebuild embeddings table by wiping it clean
 */
async function nuclearRebuildEmbeddings(db, configPath) {
  // Prevent concurrent rebuilds
  if (globalThis.isRebuilding) {
    console.log('⏳ Nuclear rebuild already in progress, waiting...');
    return;
  }

  globalThis.isRebuilding = true;

  try {
    console.log('Starting embeddings rebuild...');
    
    // Notify UI that rebuild is starting
    if (globalThis.mainWindow) {
      globalThis.mainWindow.webContents.send('rebuild-started', {
        message: 'Rebuilding database for model change...',
        model: getCurrentEmbeddingModel()
      });
    }
    
    // Get all raw data before nuking embeddings table
    const rawTable = await db.openTable('items_raw');
    const allRawItems = await rawTable.query().toArray();
    
    console.log(`📦 Backing up ${allRawItems.length} raw items`);
    
    // Nuclear option: Force delete the embeddings table directory at filesystem level
    const config = JSON.parse(fs.readFileSync(configPath));
    const dbPath = config.storage_path;
    const embeddingsPath = path.join(dbPath, 'items_embeddings.lance');
    
    console.log('💥 Nuclear deletion of corrupted embeddings table...');
    
    // Force delete at filesystem level - this is the most reliable approach
    if (fs.existsSync(embeddingsPath)) {
      fs.rmSync(embeddingsPath, { recursive: true, force: true });
      console.log('🗑️  Forcibly removed corrupted embedding files');
    }

    // Wait a bit for filesystem to catch up
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Recreate fresh embeddings table
    console.log('🔄 Creating fresh embeddings table...');
    const sampleData = [{
      id: 'sample',
      embedding_model: getCurrentEmbeddingModel(),
      vector: createZeroVector(),
      created_at: new Date().toISOString(),
    }];
    
    const newEmbeddingTable = await db.createTable('items_embeddings', sampleData);
    await newEmbeddingTable.delete('id = "sample"');
    
    // Regenerate embeddings for all items with current model
    console.log(`🔄 Regenerating ${allRawItems.length} embeddings with ${getCurrentEmbeddingModel()}...`);
    let successCount = 0;
    let errorCount = 0;
    
    for (const item of allRawItems) {
      try {
        const embedding = await generateEmbedding(item.payload + ' ' + item.description);
        await newEmbeddingTable.add([{
          id: item.id,
          embedding_model: getCurrentEmbeddingModel(),
          vector: embedding,
          created_at: new Date().toISOString(),
        }]);
        successCount++;
        
        // Update progress
        if (globalThis.mainWindow) {
          globalThis.mainWindow.webContents.send('rebuild-progress', {
            current: successCount + errorCount,
            total: allRawItems.length,
            success: successCount,
            errors: errorCount
          });
        }
      } catch (error) {
        console.error(`Failed to regenerate embedding for item ${item.id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`✅ Nuclear rebuild complete: ${successCount} success, ${errorCount} errors`);
    
    // Notify UI that rebuild is complete
    if (globalThis.mainWindow) {
      globalThis.mainWindow.webContents.send('rebuild-complete', {
        success: successCount,
        errors: errorCount,
        model: getCurrentEmbeddingModel()
      });
    }
  } catch (error) {
    console.error('💥 Nuclear rebuild failed catastrophically:', error);
    
    // Notify UI of failure
    if (globalThis.mainWindow) {
      globalThis.mainWindow.webContents.send('rebuild-error', {
        error: error.message
      });
    }
    
    throw error;
  } finally {
    globalThis.isRebuilding = false;
  }
}

/**
 * Completely rebuild the embeddings table from raw data
 */
async function rebuildEmbeddingsTable(db, configPath = null) {
  try {
    console.log('🔄 Rebuilding embeddings table...');
    
    // Get all raw data before dropping embeddings table
    const rawTable = await db.openTable('items_raw');
    const allRawItems = await rawTable.query().toArray();
    
    // Drop and recreate embeddings table with correct dimensions
    try {
      await db.dropTable('items_embeddings');
    } catch (dropError) {
      console.warn('Could not drop embeddings table, it may not exist:', dropError.message);
    }
    
    const sampleData = [{
      id: 'sample',
      embedding_model: getCurrentEmbeddingModel(),
      vector: createZeroVector(),
      created_at: new Date().toISOString(),
    }];
    
    let newEmbeddingTable;
    try {
      newEmbeddingTable = await db.createTable('items_embeddings', sampleData);
    } catch (createError) {
      if (createError.message.includes('already exists')) {
        console.log('Embeddings table already exists, using existing table');
        newEmbeddingTable = await db.openTable('items_embeddings');
        // Clear the existing table
        try {
          const existingItems = await newEmbeddingTable.query().toArray();
          if (existingItems.length > 0) {
            await newEmbeddingTable.delete('id != ""'); // Delete all rows
          }
        } catch (clearError) {
          console.warn('Could not clear existing embeddings table:', clearError.message);
        }
      } else {
        throw createError;
      }
    }
    
    // Remove sample data if it exists
    try {
      await newEmbeddingTable.delete('id = "sample"');
    } catch (sampleDeleteError) {
      // Sample might not exist, ignore error
    }
    
    // Regenerate embeddings for all items with current model
    console.log(`Regenerating ${allRawItems.length} embeddings with current model...`);
    let successCount = 0;
    let errorCount = 0;
    
    for (const item of allRawItems) {
      try {
        const embedding = await generateEmbedding(item.payload + ' ' + item.description, db, configPath);
        await newEmbeddingTable.add([{
          id: item.id,
          embedding_model: getCurrentEmbeddingModel(),
          vector: embedding,
          created_at: new Date().toISOString(),
        }]);
        successCount++;
      } catch (error) {
        console.error(`Failed to regenerate embedding for item ${item.id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`✅ Embeddings table rebuilt: ${successCount} success, ${errorCount} errors`);
  } catch (error) {
    console.error('Critical error rebuilding embeddings table:', error);
    throw error;
  }
}

/**
 * Check database health and fix any corruption issues
 */
async function checkDatabaseHealthInternal(configPath) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath));
    const db = await lancedb.connect(config.storage_path);
    
    // Check if embeddings table exists and is accessible
    try {
      const embeddingTable = await db.openTable('items_embeddings');
      const testQuery = await embeddingTable.query().limit(1).toArray();
      console.log('✅ Database health check passed');
      return true;
    } catch (error) {
      if (error.message.includes('Object at location') && error.message.includes('not found')) {
        console.warn('🔧 Database corruption detected, rebuilding embeddings table...');
        await rebuildEmbeddingsTable(db, configPath);
        return true;
      }
      throw error;
    }
  } catch (error) {
    console.error('❌ Database health check failed:', error);
    return false;
  }
}

/**
 * Generate embeddings for text using the current model (lightweight or TensorFlow)
 * @param {string} text - Text to embed
 * @param {object} db - LanceDB connection (optional)
 * @param {string} configPath - Path to config file (required if db provided)
 * @returns {Promise<number[]>} Embedding vector
 */
async function generateEmbedding(text, db = null, configPath = null) {
    await ensureEmbeddingInitialized();
    
    // Only check compatibility if not already rebuilding (avoid infinite loops)
    if (db && configPath && !globalThis.isRebuilding) {
      await ensureEmbeddingTableCompatible(db, configPath);
    }
    
    return await embeddingManager.generateEmbedding(text);
}

export async function addItem(item, configPath) {
  try {
    const itemId = uuidv4();
    const now = new Date().toISOString();
    
    const config = JSON.parse(fs.readFileSync(configPath));
    const db = await lancedb.connect(config.storage_path);
    
    // Generate embedding with database compatibility check
    const embedding = await generateEmbedding(item.payload + ' ' + item.description, db, configPath);
    
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
      embedding_model: getCurrentEmbeddingModel(),
      vector: embedding,
      created_at: now,
    }]);
    
  } catch (error) {
    console.error('❌ ERROR in addItem:', error);
    throw new Error(`Failed to add item: ${error.message}`);
  }
}

export async function updateItem(itemId, updates, configPath) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath));
    const db = await lancedb.connect(config.storage_path);
    
    // Get the current item first
    const rawTable = await db.openTable('items_raw');
    const currentItems = await rawTable.query().where(`id = "${itemId}"`).toArray();
    
    if (currentItems.length === 0) {
      throw new Error(`Item with id ${itemId} not found`);
    }
    
    const currentItem = currentItems[0];
    const now = new Date().toISOString();
    
    // Update the raw data
    const updatedItem = {
      ...currentItem,
      ...updates,
      last_accessed_at: now, // Always update last accessed
    };
    
    // Delete old item
    await rawTable.delete(`id = "${itemId}"`);
    
    // Add updated item
    await rawTable.add([updatedItem]);
    
    // If payload or description changed, regenerate embedding
    if (updates.payload !== undefined || updates.description !== undefined) {
      const newText = updatedItem.payload + ' ' + updatedItem.description;
      const newEmbedding = await generateEmbedding(newText, db, configPath);
      
      // Update embedding
      const embeddingTable = await db.openTable('items_embeddings');
      await embeddingTable.delete(`id = "${itemId}"`);
      await embeddingTable.add([{
        id: itemId,
        embedding_model: getCurrentEmbeddingModel(),
        vector: newEmbedding,
        created_at: now,
      }]);
    }
    
    return updatedItem;
  } catch (error) {
    console.error('Detailed error in updateItem:', error);
    console.error('Error stack:', error.stack);
    throw new Error(`Failed to update item: ${error.message}`);
  }
}

export async function searchItems(query, configPath) {
  const config = JSON.parse(fs.readFileSync(configPath));
  const db = await lancedb.connect(config.storage_path);

  if (!query) {
    return [];
  }

  try {
    // Ensure embedding table is compatible with current model
    await ensureEmbeddingTableCompatible(db, configPath);
    
    const queryEmbedding = await generateEmbedding(query, db, configPath);

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
      await ensureEmbeddingCurrent(rawItem.id, db, configPath);
      
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
      await ensureEmbeddingCurrent(item.id, db, configPath);
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
        await ensureEmbeddingCurrent(item.id, db, configPath);
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

export async function importData(configPath, importData, format = 'json', progressCallback = null) {
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
    
    // Send initial progress
    if (progressCallback) {
      progressCallback({ current: 0, total: items.length, success: 0, errors: 0 });
    }
    
    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i];
        const itemId = item.id || uuidv4(); // Use existing ID if provided
        const now = new Date().toISOString();
        const embedding = await generateEmbedding(item.payload + ' ' + item.description, db, configPath);
        
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
          embedding_model: getCurrentEmbeddingModel(),
          vector: embedding,
          created_at: now,
        }]);
        
        successCount++;
      } catch (error) {
        errorCount++;
        errors.push(`Item ${i + 1}: ${error.message}`);
        console.error(`Error importing item ${i + 1}:`, error);
      }
      
      // Send progress update
      if (progressCallback) {
        progressCallback({ 
          current: i + 1, 
          total: items.length, 
          success: successCount, 
          errors: errorCount 
        });
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
      embedding_model: getCurrentEmbeddingModel(),
      vector: createZeroVector(),
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
        const newEmbedding = await generateEmbedding(item.payload + ' ' + item.description, db, configPath);
        
        // Remove old embedding
        await embeddingTable.delete(`id = "${item.id}"`);
        
        // Add new embedding
        await embeddingTable.add([{
          id: item.id,
          embedding_model: getCurrentEmbeddingModel(),
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
      message: `Regenerated ${regeneratedCount} embeddings with model ${getCurrentEmbeddingModel()}`,
      regeneratedCount,
      totalItems: allItems.length,
    };
  } catch (error) {
    console.error('Detailed error in regenerateAllEmbeddings:', error);
    console.error('Error stack:', error.stack);
    throw new Error(`Failed to regenerate embeddings: ${error.message}`);
  }
}

/**
 * Get available embedding models
 */
export function getAvailableModels() {
  return {
    [EMBEDDING_MODELS.LIGHTWEIGHT]: {
      id: EMBEDDING_MODELS.LIGHTWEIGHT,
      name: 'Fast (Built-in)',
      description: 'Instant startup, basic semantic matching',
      features: [
        'Instant startup',
        'No downloads',
        'Basic semantic matching',
        'Keyword-based search',
        'Good for simple queries'
      ]
    },
    [EMBEDDING_MODELS.TENSORFLOW]: {
      id: EMBEDDING_MODELS.TENSORFLOW,
      name: 'Smart (AI Download)',
      description: 'Advanced semantic understanding (~20MB download)',
      features: [
        'Advanced semantic understanding',
        'Context-aware search',
        'Handles complex queries',
        'Multi-language support',
        'State-of-the-art accuracy'
      ]
    }
  };
}

/**
 * Set the embedding model type
 */
export async function setEmbeddingModelType(modelType) {
  await embeddingManager.setModelType(modelType);
  return {
    success: true,
    currentModel: getCurrentEmbeddingModel(),
    modelType
  };
}

/**
 * Get current model type
 */
export function getCurrentModelType() {
  return embeddingManager.getCurrentModelType();
}

/**
 * Check if TensorFlow model can be loaded
 */
export async function canLoadTensorFlow() {
  return await embeddingManager.canLoadTensorFlow();
}

/**
 * Check database health and repair corruption if found
 */
export async function checkDatabaseHealth(configPath) {
  return await checkDatabaseHealthInternal(configPath);
}

/**
 * Complete database reset - removes all corrupted files and recreates clean database
 */
export async function resetDatabase(configPath) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath));
    const dbPath = config.storage_path;
    
    console.log('🔄 Performing complete database reset...');
    
    // Close any existing connections by creating a new connection and closing it
    try {
      const tempDb = await lancedb.connect(dbPath);
      // Let it auto-close
    } catch (e) {
      // Ignore connection errors
    }
    
    // Remove corrupted database directory
    if (fs.existsSync(dbPath)) {
      console.log('🗑️  Removing corrupted database files...');
      fs.rmSync(dbPath, { recursive: true, force: true });
    }
    
    // Recreate database directory
    fs.mkdirSync(dbPath, { recursive: true });
    
    // Initialize fresh database
    const db = await lancedb.connect(dbPath);
    
    // Create fresh raw items table
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
    
    // Create fresh embeddings table
    const sampleEmbeddingData = [{
      id: 'sample',
      embedding_model: getCurrentEmbeddingModel(),
      vector: createZeroVector(),
      created_at: new Date().toISOString(),
    }];
    
    const embeddingTable = await db.createTable('items_embeddings', sampleEmbeddingData);
    await embeddingTable.delete('id = "sample"');
    
    console.log('✅ Database reset complete - fresh database created');
    
    return {
      success: true,
      message: 'Database reset successfully - all corrupted files removed'
    };
    
  } catch (error) {
    console.error('❌ Failed to reset database:', error);
    throw error;
  }
}
