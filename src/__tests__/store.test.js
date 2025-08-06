const fs = require('fs');
const { initializeDatabase, get_config_path } = require('../store');
const arrow = require('apache-arrow');

// Mocking dependencies
jest.mock('fs');
jest.mock('@xenova/transformers', () => ({}));
jest.mock('@lancedb/lancedb', () => ({
  connect: jest.fn().mockResolvedValue({
    tableNames: jest.fn().mockResolvedValue([]),
    createEmptyTable: jest.fn().mockResolvedValue(),
  }),
}));

const mockDialog = {
  showOpenDialog: jest.fn(),
  showMessageBox: jest.fn(),
  showErrorBox: jest.fn(),
};

const mockApp = {
  quit: jest.fn(),
  getPath: jest.fn().mockReturnValue('/tmp'),
};

describe('store', () => {
  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    fs.existsSync.mockClear();
    fs.readFileSync.mockClear();
    fs.writeFileSync.mockClear();
    mockDialog.showOpenDialog.mockClear();
    mockDialog.showMessageBox.mockClear();
    mockDialog.showErrorBox.mockClear();
    mockApp.quit.mockClear();
  });

  it('should create a new config file if one does not exist', async () => {
    fs.existsSync.mockReturnValue(false);
    mockDialog.showOpenDialog.mockResolvedValue({ filePaths: ['/test/path'] });

    const configPath = get_config_path(mockApp.getPath('userData'));
    await initializeDatabase(configPath, mockDialog, mockApp);

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      configPath,
      JSON.stringify({ storage_path: '/test/path' }, null, 2)
    );
  });

  it('should use an existing config file if one is present', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify({ storage_path: '/existing/path' }));

    const configPath = get_config_path(mockApp.getPath('userData'));
    await initializeDatabase(configPath, mockDialog, mockApp);

    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('should quit the app if the user cancels the dialog', async () => {
    fs.existsSync.mockReturnValue(false);
    mockDialog.showOpenDialog.mockResolvedValue({ filePaths: [] });

    const configPath = get_config_path(mockApp.getPath('userData'));
    await initializeDatabase(configPath, mockDialog, mockApp);

    expect(mockApp.quit).toHaveBeenCalled();
  });
});