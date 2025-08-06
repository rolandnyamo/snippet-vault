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
        const schema = new arrow.Schema([
          new arrow.Field('id', new arrow.Utf8(), false),
          new arrow.Field('type', new arrow.Utf8(), false),
          new arrow.Field('payload', new arrow.Utf8(), false),
          new arrow.Field('description', new arrow.Utf8(), false),
          new arrow.Field('created_at', new arrow.Utf8(), false),
          new arrow.Field('last_accessed_at', new arrow.Utf8(), false),
          new arrow.Field('embedding_model', new arrow.Utf8(), false),
          new arrow.Field('vector', new arrow.FixedSizeList(384, new arrow.Field('item', new arrow.Float32()))),
        ]);
        await db.createEmptyTable('items', schema);
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
      embedding_model: 'Xenova/all-MiniLM-L6-v2',
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
