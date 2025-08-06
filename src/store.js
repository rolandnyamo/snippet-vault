const fs = require('fs');
const lancedb = require('@lancedb/lancedb');
const path = require('node:path');

function get_config_path(userDataPath) {
    return path.join(userDataPath, 'config.json');
}

async function initializeDatabase(configPath, dialog, app) {
  let config = {};
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath));
  }

  if (!config.storage_path) {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'lancedb');
    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(dbPath, { recursive: true });
    }
    config.storage_path = dbPath;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  try {
    const db = await lancedb.connect(config.storage_path);
    const tables = await db.tableNames();
    if (!tables.includes('items')) {
      await db.createTable('items', [
        { vector: [], text: 'sample', id: '1' },
      ]);
    }
  } catch (err) {
    console.error('Error initializing database:', err);
    await dialog.showMessageBox({
      type: 'error',
      title: 'Database Error',
      message: 'Could not initialize the database. Please check the path and permissions.',
      buttons: ['Quit'],
    });
    app.quit();
  }
}

const { v4: uuidv4 } = require('uuid');

async function addItem(item, configPath) {
  const { pipeline } = await import('@xenova/transformers');
  const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

  const embedding = await embedder(item.payload + ' ' + item.description, {
    pooling: 'mean',
    normalize: true,
  });

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
        vector: Array.from(embedding.data),
  }]);
}

async function searchItems(query, configPath) {
  const config = JSON.parse(fs.readFileSync(configPath));
  const db = await lancedb.connect(config.storage_path);
  const table = await db.openTable('items');

  if (!query) {
    return [];
  }

  const { pipeline } = await import('@xenova/transformers');
  const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  const queryEmbedding = await embedder(query, { pooling: 'mean', normalize: true });

  const results = await table
    .search(Array.from(queryEmbedding.data))
    .where(`description LIKE '%${query}%'`)
    .limit(10)
    .execute();

  return results;
}

async function getRecentItems(configPath) {
  const config = JSON.parse(fs.readFileSync(configPath));
  const db = await lancedb.connect(config.storage_path);
  const table = await db.openTable('items');

  const results = await table.select('*').orderBy('last_accessed_at DESC').limit(5).execute();

  return results;
}

module.exports = { initializeDatabase, get_config_path, addItem, searchItems, getRecentItems };
