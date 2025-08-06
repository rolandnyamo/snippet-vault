const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('node:path');
const { initializeDatabase, get_config_path, addItem, searchItems, getRecentItems } = require('./store');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

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

  ipcMain.on('add-item', (event, item) => {
    const configPath = get_config_path(app.getPath('userData'));
    addItem(item, configPath);
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
