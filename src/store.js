const fs = require('fs');
const lancedb = require('@lancedb/lancedb');
const path = require('node:path');

function get_config_path(userDataPath) {
    return path.join(userDataPath, 'config.json');
}

const arrow = require('apache-arrow');

async function initializeDatabase(configPath, dialog, app) {
  let config = {};
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath));
  }

  let db;
  while (true) {
    if (!config.storage_path) {
      const { filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select a folder to store your data',
      });

      if (filePaths && filePaths.length > 0) {
        config.storage_path = filePaths[0];
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      } else {
        app.quit();
        return;
      }
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
        message: 'Could not initialize the database. Please check the path and permissions.',
        buttons: ['Quit', 'Choose New Folder'],
      });

      if (response === 1) { // Choose New Folder
        config.storage_path = null; // Clear the path to re-trigger the selection dialog
      } else {
        app.quit();
        return;
      }
    }
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
