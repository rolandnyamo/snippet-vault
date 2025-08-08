import fs from 'fs';
import lancedb from '@lancedb/lancedb';
import { embeddingManager, EMBEDDING_MODELS } from '../embeddings/index.js';

// Initialize embedding system
let isEmbeddingInitialized = false;

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

// Internal helpers needed by other modules
export { createZeroVector, ensureEmbeddingCurrent, ensureEmbeddingTableCompatible, generateEmbedding, rebuildEmbeddingsTable };
