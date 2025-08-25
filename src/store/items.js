import fs from 'fs';
import lancedb from '@lancedb/lancedb';
import { v4 as uuidv4 } from 'uuid';
import { generateEmbedding, getCurrentEmbeddingModel, ensureEmbeddingTableCompatible, ensureEmbeddingCurrent, createZeroVector } from './embeddings/index.js';

export async function addItem(item, configPath) {
  try {
    const itemId = uuidv4();
    const now = new Date().toISOString();
    
    const config = JSON.parse(fs.readFileSync(configPath));
    const db = await lancedb.connect(config.storage_path);

    // Ensure embedding table is compatible before generating embedding
    await ensureEmbeddingTableCompatible(db, configPath);
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
    
    console.log(`✅ Successfully added item with ID: ${itemId}`);
    return { id: itemId, ...item, created_at: now, last_accessed_at: now };
    
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
      await ensureEmbeddingTableCompatible(db, configPath);
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

// Helper function to normalize text for fuzzy searching
function normalizeForSearch(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, '') // Remove all spaces
    .replace(/[_-]/g, '') // Remove underscores and hyphens
    .trim();
}

// Helper function to create fuzzy search patterns
function createSearchPatterns(query) {
  const normalized = normalizeForSearch(query);
  const patterns = [
    // Exact match (original behavior)
    query.toLowerCase(),
    // Normalized match (no spaces/underscores/hyphens)
    normalized,
    // Split into words and match each
    ...query.toLowerCase().split(/\s+/).filter(word => word.length > 1)
  ];
  
  return [...new Set(patterns)]; // Remove duplicates
}

// Enhanced fuzzy text search function
async function fuzzyTextSearch(rawTable, query) {
  const patterns = createSearchPatterns(query);
  const allResults = new Map();

  // Try each pattern and collect results
  for (const pattern of patterns) {
    const results = await rawTable
      .query()
      .where(`LOWER(description) LIKE '%${pattern}%' OR LOWER(payload) LIKE '%${pattern}%'`)
      .toArray();
    
    // Add to results map (deduplicates by id)
    results.forEach(item => {
      if (!allResults.has(item.id)) {
        allResults.set(item.id, item);
      }
    });
  }

  // Also try normalized field matching for common patterns
  // This handles cases like "resourceType" vs "resource type"
  const normalizedQuery = normalizeForSearch(query);
  if (normalizedQuery.length > 2) {
    const normalizedResults = await rawTable
      .query()
      .where(`REPLACE(REPLACE(REPLACE(LOWER(description), ' ', ''), '_', ''), '-', '') LIKE '%${normalizedQuery}%' OR REPLACE(REPLACE(REPLACE(LOWER(payload), ' ', ''), '_', ''), '-', '') LIKE '%${normalizedQuery}%'`)
      .toArray();
    
    normalizedResults.forEach(item => {
      if (!allResults.has(item.id)) {
        allResults.set(item.id, item);
      }
    });
  }

  return Array.from(allResults.values());
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

    // Get all raw items that match text search with fuzzy matching
    const rawResults = await fuzzyTextSearch(rawTable, query);

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

    await ensureEmbeddingTableCompatible(db, configPath);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // Send initial progress
    if (progressCallback) {
      progressCallback({ current: 0, total: items.length, success: 0, errors: 0 });
    }
    
    for (let i = 0; i < items.length; i++) {
      try {
  // Normalize imported item to ensure clean display and consistent storage
  const item = normalizeImportedItem(items[i]);
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

// Normalize imported item to improve display and consistency
function normalizeImportedItem(item) {
  const out = { ...item };
  // Basic trims
  if (typeof out.description === 'string') out.description = out.description.trim();
  if (typeof out.payload === 'string') out.payload = out.payload.replace(/\r\n/g, '\n').trim();

  // For kusto_query, if first non-empty line is a URL, keep it; collapse excessive whitespace in query body
  if (out.type === 'kusto_query' && typeof out.payload === 'string') {
    const lines = out.payload.split('\n');
    const firstIdx = lines.findIndex(l => l.trim().length > 0);
    if (firstIdx >= 0) {
      const firstLine = lines[firstIdx].trim();
      const looksLikeUrl = /^https?:\/\//i.test(firstLine);
      if (looksLikeUrl) {
        // Keep as-is: first line URL and body lines following
        const body = lines.slice(firstIdx + 1).join('\n').trim();
        // Normalize body whitespace lightly (collapse trailing spaces)
        const normalizedBody = body.replace(/[\t ]+$/gm, '');
        out.payload = `${firstLine}\n${normalizedBody}`.trim();
      } else {
        // No URL present: normalize body whitespace only
        out.payload = out.payload.replace(/[\t ]+$/gm, '');
      }
    }
  }

  // For links, ensure payload is a clean URL (trim only)
  if (out.type === 'link' && typeof out.payload === 'string') {
    out.payload = out.payload.trim();
  }

  return out;
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
