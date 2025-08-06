// Force transformers to use web backend only (MUST be before any other imports)
process.env.TRANSFORMERS_BACKEND = 'web';
process.env.TRANSFORMERS_FORCE_WEB = 'true';
process.env.ONNX_WEB = 'true';
process.env.ONNXRUNTIME_NODE_DISABLED = 'true';

import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

import { initializeDatabase, get_config_path, addItem, searchItems, getRecentItems, deleteItem, getAllItems, exportData, getDataPath, importData, deleteAllData } from './store.js';

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

  // and load the index.html of the app.
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  const configPath = get_config_path(app.getPath('userData'));
  await initializeDatabase(configPath, dialog, app);
  createWindow();

  ipcMain.on('add-item', async (event, item) => {
    const configPath = get_config_path(app.getPath('userData'));
    try {
      await addItem(item, configPath);
      event.sender.send('item-added', item);
    } catch (error) {
      console.error('Error adding item:', error);
      event.sender.send('item-add-error', error.message);
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
    const { shell } = require('electron');
    shell.showItemInFolder(path);
  });

  ipcMain.on('import-data', async (event, { data, format }) => {
    try {
      const configPath = get_config_path(app.getPath('userData'));
      const result = await importData(configPath, data, format);
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
