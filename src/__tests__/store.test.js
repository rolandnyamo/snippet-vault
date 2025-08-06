const fs = require('fs');
const path = require('node:path');
const { initializeDatabase, get_config_path } = require('../store');

// Mocking dependencies
jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
}));
jest.mock('@xenova/transformers', () => ({}));
jest.mock('@lancedb/lancedb', () => ({
  connect: jest.fn().mockResolvedValue({
    tableNames: jest.fn().mockResolvedValue([]),
    createTable: jest.fn().mockResolvedValue(),
  }),
}));

const mockDialog = {
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
    fs.mkdirSync.mockClear();
    mockDialog.showErrorBox.mockClear();
    mockApp.quit.mockClear();
  });

  it('should create a new config file and directory if one does not exist', async () => {
    // Mock that config and db directory don't exist
    fs.existsSync.mockReturnValue(false);

    const userDataPath = mockApp.getPath('userData');
    const configPath = get_config_path(userDataPath);
    const dbPath = path.join(userDataPath, 'lancedb');

    await initializeDatabase(configPath, mockDialog, mockApp);

    // Expect that the directory was created
    expect(fs.mkdirSync).toHaveBeenCalledWith(dbPath, { recursive: true });

    // Expect that the config file was written with the correct path
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      configPath,
      JSON.stringify({ storage_path: dbPath }, null, 2)
    );
  });

  it('should use an existing config file if one is present', async () => {
    const userDataPath = mockApp.getPath('userData');
    const configPath = get_config_path(userDataPath);
    const dbPath = path.join(userDataPath, 'lancedb');

    // Mock that config exists, but db path might not
    fs.existsSync.mockImplementation(p => p === configPath);
    fs.readFileSync.mockReturnValue(JSON.stringify({ storage_path: dbPath }));

    await initializeDatabase(configPath, mockDialog, mockApp);

    // Expect that nothing new was written or created
    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });
});