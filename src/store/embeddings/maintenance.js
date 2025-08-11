import fs from 'fs';
import path from 'path';
import lancedb from '@lancedb/lancedb';
import { getCurrentEmbeddingModel, getCurrentDimensions, createZeroVector } from './model.js';
import { generateEmbedding } from './generation.js';

/**
 * Check if embedding needs regeneration and regenerate if necessary
 */
export async function ensureEmbeddingCurrent(itemId, db, configPath = null) {
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
        await embeddingTable.add([
          {
            id: itemId,
            embedding_model: currentModel,
            vector: newEmbedding,
            created_at: new Date().toISOString(),
          }
        ]);
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
 * Check if embeddings table has correct model and dimensions, rebuild if different
 */
export async function ensureEmbeddingTableCompatible(db, configPath) {
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
export async function nuclearRebuildEmbeddings(db, configPath) {
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
    const sampleData = [
      {
        id: 'sample',
        embedding_model: getCurrentEmbeddingModel(),
        vector: createZeroVector(),
        created_at: new Date().toISOString(),
      }
    ];

    const newEmbeddingTable = await db.createTable('items_embeddings', sampleData);
    await newEmbeddingTable.delete('id = "sample"');

    // Regenerate embeddings for all items with current model
    console.log(`🔄 Regenerating ${allRawItems.length} embeddings with ${getCurrentEmbeddingModel()}...`);
    let successCount = 0;
    let errorCount = 0;

    for (const item of allRawItems) {
      try {
        const embedding = await generateEmbedding(item.payload + ' ' + item.description);
        await newEmbeddingTable.add([
          {
            id: item.id,
            embedding_model: getCurrentEmbeddingModel(),
            vector: embedding,
            created_at: new Date().toISOString(),
          }
        ]);
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
export async function rebuildEmbeddingsTable(db, configPath = null) {
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

    const sampleData = [
      {
        id: 'sample',
        embedding_model: getCurrentEmbeddingModel(),
        vector: createZeroVector(),
        created_at: new Date().toISOString(),
      }
    ];

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
        await newEmbeddingTable.add([
          {
            id: item.id,
            embedding_model: getCurrentEmbeddingModel(),
            vector: embedding,
            created_at: new Date().toISOString(),
          }
        ]);
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
        await embeddingTable.add([
          {
            id: item.id,
            embedding_model: getCurrentEmbeddingModel(),
            vector: newEmbedding,
            created_at: new Date().toISOString(),
          }
        ]);

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
