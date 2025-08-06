// Force TensorFlow.js backend - no more ONNX dependencies!
import { getEmbeddingPipeline } from './tensorflow-embeddings.js';
import fs from 'fs';
import lancedb from '@lancedb/lancedb';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import * as arrow from 'apache-arrow';

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
      if (!tables.includes('items')) {
        // Let LanceDB infer the schema from the first row of data
        // This is more reliable than manually defining complex schemas
        const sampleData = [{
          id: 'sample',
          type: 'text',
          payload: 'sample payload',
          description: 'sample description',
          created_at: new Date().toISOString(),
          last_accessed_at: new Date().toISOString(),
          embedding_model: 'tensorflow/universal-sentence-encoder',
          vector: new Array(512).fill(0.0), // Sample 512-dimensional vector
        }];
        
        const table = await db.createTable('items', sampleData);
        // Remove the sample data
        await table.delete('id = "sample"');
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
        // Try again with the same path
        continue;
      } else {
        app.quit();
        return;
      }
    }
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
    const embedding = await generateEmbedding(item.payload + ' ' + item.description);

    const config = JSON.parse(fs.readFileSync(configPath));
    const db = await lancedb.connect(config.storage_path);
    const table = await db.openTable('items');

    await table.add([{
      id: uuidv4(),
      type: item.type,
      payload: item.payload,
      description: item.description,
      created_at: new Date().toISOString(),
      last_accessed_at: new Date().toISOString(),
      embedding_model: 'tensorflow/universal-sentence-encoder',
      vector: embedding,
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
  const table = await db.openTable('items');

  if (!query) {
    return [];
  }

  try {
    const queryEmbedding = await generateEmbedding(query);

    // Make search case-insensitive and search both description and payload
    const searchPattern = query.toLowerCase();
    const rawResults = await table
      .search(queryEmbedding)
      .where(`LOWER(description) LIKE '%${searchPattern}%' OR LOWER(payload) LIKE '%${searchPattern}%'`)
      .limit(10)
      .toArray();

    return rawResults.map(({ vector, ...rest }) => rest);
  } catch (error) {
    console.error('Detailed error in searchItems:', error);
    console.error('Error stack:', error.stack);
    throw new Error(`Failed to search items: ${error.message}`);
  }
}

export async function getRecentItems(configPath) {
  const config = JSON.parse(fs.readFileSync(configPath));
  const db = await lancedb.connect(config.storage_path);
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
}

export async function deleteItem(itemId, configPath) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath));
    const db = await lancedb.connect(config.storage_path);
    const table = await db.openTable('items');

    await table.delete(`id = "${itemId}"`);
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
    console.error('Detailed error in getAllItems:', error);
    console.error('Error stack:', error.stack);
    throw new Error(`Failed to get all items: ${error.message}`);
  }
}

export async function exportData(configPath, format = 'json') {
  try {
    const items = await getAllItems(configPath);
    
    if (format === 'csv') {
      // Convert to CSV format
      const headers = ['id', 'type', 'description', 'payload', 'created_at', 'last_accessed_at', 'embedding_model'];
      const csvRows = [
        headers.join(','),
        ...items.map(item => 
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
      return JSON.stringify(items, null, 2);
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
    
    // Import each item (this will generate embeddings and append to existing data)
    const config = JSON.parse(fs.readFileSync(configPath));
    const db = await lancedb.connect(config.storage_path);
    const table = await db.openTable('items');
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i];
        const embedding = await generateEmbedding(item.payload + ' ' + item.description);
        
        await table.add([{
          id: uuidv4(),
          type: item.type,
          payload: item.payload,
          description: item.description,
          created_at: item.created_at || new Date().toISOString(),
          last_accessed_at: item.last_accessed_at || new Date().toISOString(),
          embedding_model: 'tensorflow/universal-sentence-encoder',
          vector: embedding,
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
    
    // Drop the table and recreate it
    await db.dropTable('items');
    
    // Recreate the table with sample data for schema inference
    const sampleData = [{
      id: 'sample',
      type: 'text',
      payload: 'sample payload',
      description: 'sample description',
      created_at: new Date().toISOString(),
      last_accessed_at: new Date().toISOString(),
      embedding_model: 'tensorflow/universal-sentence-encoder',
      vector: new Array(512).fill(0.0),
    }];
    
    const table = await db.createTable('items', sampleData);
    // Remove the sample data
    await table.delete('id = "sample"');
    
    return { success: true, message: 'All data deleted successfully' };
  } catch (error) {
    console.error('Detailed error in deleteAllData:', error);
    console.error('Error stack:', error.stack);
    throw new Error(`Failed to delete all data: ${error.message}`);
  }
}
