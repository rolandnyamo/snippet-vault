// Force transformers to use web backend only (MUST be before any other imports)
process.env.TRANSFORMERS_BACKEND = 'web';
process.env.TRANSFORMERS_FORCE_WEB = 'true';
process.env.ONNX_WEB = 'true';
process.env.ONNXRUNTIME_NODE_DISABLED = 'true';

import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { initializeDatabase, get_config_path, addItem, searchItems, getRecentItems, deleteItem, getAllItems, exportData, getDataPath, importData, deleteAllData, getCurrentEmbeddingModel, regenerateAllEmbeddings, getAvailableModels, setEmbeddingModelType, getCurrentModelType, canLoadTensorFlow, resetDatabase, updateItem } from './store/index.js';

// Get the current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// Note: We need to use dynamic import for this CommonJS module
const { default: electronSquirrelStartup } = await import('electron-squirrel-startup');
if (electronSquirrelStartup) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
  });

  // Store reference globally for rebuild notifications
  globalThis.mainWindow = mainWindow;

  // and load the index.html of the app.
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  return mainWindow;
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  const configPath = get_config_path(app.getPath('userData'));
  await initializeDatabase(configPath, dialog, app);
  createWindow();

  ipcMain.handle('add-item', async (event, itemData) => {
    try {
      await addItem(itemData, configPath);
      mainWindow?.webContents.send('item-added');
    } catch (error) {
      console.error('Error in add-item IPC handler:', error);
      throw error;
    }
  });

  ipcMain.handle('update-item', async (event, itemId, updates) => {
    try {
      const updatedItem = await updateItem(itemId, updates, configPath);
      mainWindow?.webContents.send('item-updated', updatedItem);
      return updatedItem;
    } catch (error) {
      console.error('Error updating item:', error);
      throw error;
    }
  });

  ipcMain.on('search-items', async (event, query) => {
    const configPath = get_config_path(app.getPath('userData'));
    const results = await searchItems(query, configPath);
    event.sender.send('search-results', results);
  });

  ipcMain.on('get-recent-items', async (event) => {
    const configPath = get_config_path(app.getPath('userData'));
    const items = await getRecentItems(configPath);
    event.sender.send('recent-items', items);
  });

  ipcMain.on('get-all-items', async (event) => {
    const configPath = get_config_path(app.getPath('userData'));
    const items = await getAllItems(configPath);
    event.sender.send('all-items', items);
  });

  ipcMain.on('delete-item', async (event, itemId) => {
    try {
      const configPath = get_config_path(app.getPath('userData'));
      await deleteItem(itemId, configPath);
      event.sender.send('item-deleted', itemId);
    } catch (error) {
      console.error('Error deleting item:', error);
      event.sender.send('item-delete-error', error.message);
    }
  });

  ipcMain.on('export-data', async (event, format) => {
    try {
      const configPath = get_config_path(app.getPath('userData'));
      const data = await exportData(configPath, format);
      event.sender.send('export-data-result', data, format);
    } catch (error) {
      console.error('Error exporting data:', error);
      event.sender.send('export-data-error', error.message);
    }
  });

  ipcMain.on('get-data-path', async (event) => {
    const configPath = get_config_path(app.getPath('userData'));
    const dataPath = getDataPath(configPath);
    event.sender.send('data-path', dataPath);
  });

  ipcMain.on('show-item-in-folder', async (event, path) => {
    try {
      const { shell } = await import('electron');
      const fs = await import('fs');
      const pathModule = await import('path');
      
      // Check if path exists
      if (!fs.existsSync(path)) {
        console.error('Path does not exist:', path);
        return;
      }
      
      // If it's a file, show its parent directory
      const stats = fs.statSync(path);
      if (stats.isFile()) {
        const parentDir = pathModule.dirname(path);
        shell.showItemInFolder(parentDir);
      } else {
        shell.showItemInFolder(path);
      }
    } catch (error) {
      console.error('Error showing item in folder:', error);
    }
  });

  ipcMain.on('import-data', async (event, { data, format }) => {
    try {
      const configPath = get_config_path(app.getPath('userData'));
      
      // Progress callback to send updates to frontend
      const progressCallback = (progress) => {
        event.sender.send('import-data-progress', progress);
      };
      
      const result = await importData(configPath, data, format, progressCallback);
      event.sender.send('import-data-result', result);
    } catch (error) {
      console.error('Error importing data:', error);
      event.sender.send('import-data-error', error.message);
    }
  });

  ipcMain.on('delete-all-data', async (event) => {
    try {
      const configPath = get_config_path(app.getPath('userData'));
      const result = await deleteAllData(configPath);
      event.sender.send('delete-all-data-result', result);
    } catch (error) {
      console.error('Error deleting all data:', error);
      event.sender.send('delete-all-data-error', error.message);
    }
  });

  ipcMain.on('get-embedding-model', async (event) => {
    try {
      const model = getCurrentEmbeddingModel();
      event.sender.send('embedding-model', model);
    } catch (error) {
      console.error('Error getting embedding model:', error);
      event.sender.send('embedding-model-error', error.message);
    }
  });

  ipcMain.on('regenerate-embeddings', async (event) => {
    try {
      const configPath = get_config_path(app.getPath('userData'));
      const result = await regenerateAllEmbeddings(configPath);
      event.sender.send('regenerate-embeddings-result', result);
    } catch (error) {
      console.error('Error regenerating embeddings:', error);
      event.sender.send('regenerate-embeddings-error', error.message);
    }
  });

  ipcMain.on('reset-database', async (event) => {
    try {
      const configPath = get_config_path(app.getPath('userData'));
      const result = await resetDatabase(configPath);
      event.sender.send('reset-database-result', result);
    } catch (error) {
      console.error('Error resetting database:', error);
      event.sender.send('reset-database-error', error.message);
    }
  });

  // Model selection IPC handlers
  ipcMain.on('get-available-models', async (event) => {
    try {
      const models = getAvailableModels();
      event.sender.send('available-models-result', models);
    } catch (error) {
      event.sender.send('available-models-error', error.message);
    }
  });

  ipcMain.on('set-model-type', async (event, modelType) => {
    try {
      const result = await setEmbeddingModelType(modelType);
      event.sender.send('model-type-set', result);
    } catch (error) {
      event.sender.send('model-type-error', error.message);
    }
  });

  ipcMain.on('get-current-model-type', async (event) => {
    try {
      const modelType = getCurrentModelType();
      event.sender.send('current-model-type-result', modelType);
    } catch (error) {
      event.sender.send('current-model-type-error', error.message);
    }
  });

  ipcMain.on('can-load-tensorflow', async (event) => {
    try {
      const canLoad = await canLoadTensorFlow();
      event.sender.send('can-load-tensorflow-result', canLoad);
    } catch (error) {
      event.sender.send('can-load-tensorflow-error', error.message);
    }
  });

  ipcMain.on('is-first-time', async (event) => {
    try {
      const configPath = get_config_path(app.getPath('userData'));
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const isFirstTime = !config.hasSelectedModel;
      event.sender.send('is-first-time-result', isFirstTime);
    } catch (error) {
      // If config doesn't exist or can't be read, it's first time
      event.sender.send('is-first-time-result', true);
    }
  });

  ipcMain.on('mark-model-selected', async (event, modelType) => {
    try {
      const configPath = get_config_path(app.getPath('userData'));
      let config = {};
      try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch (e) {
        // File doesn't exist or is corrupted, start fresh
      }
      
      config.hasSelectedModel = true;
      config.selectedModel = modelType;
      
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      
      event.sender.send('model-selection-marked');
    } catch (error) {
      event.sender.send('model-selection-mark-error', error.message);
    }
  });

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
