import fs from 'fs';
import path from 'path';
import lancedb from '@lancedb/lancedb';
import { getCurrentEmbeddingModel, createZeroVector, rebuildEmbeddingsTable } from './embeddings/index.js';

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
