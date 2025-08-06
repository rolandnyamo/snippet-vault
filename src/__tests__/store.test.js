import { jest } from '@jest/globals';

// Mock modules globally
const mockReadFileSync = jest.fn();
const mockExistsSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockMkdirSync = jest.fn();

jest.unstable_mockModule('fs', () => ({
  readFileSync: mockReadFileSync,
  existsSync: mockExistsSync,
  writeFileSync: mockWriteFileSync,
  mkdirSync: mockMkdirSync,
}));

const mockConnect = jest.fn();
jest.unstable_mockModule('@lancedb/lancedb', () => ({
  default: {
    connect: mockConnect,
  }
}));

jest.unstable_mockModule('apache-arrow', () => ({
  default: {},
}));

const mockDialog = {
  showOpenDialog: jest.fn(),
  showMessageBox: jest.fn(),
  showErrorBox: jest.fn(),
};

const mockApp = {
  quit: jest.fn(),
  getPath: jest.fn().mockReturnValue('/tmp/userData'),
};

describe('store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new config file if one does not exist', async () => {
    mockExistsSync.mockReturnValue(false);
    mockConnect.mockResolvedValue({
      tableNames: jest.fn().mockResolvedValue([]),
      createTable: jest.fn().mockResolvedValue({
        delete: jest.fn()
      }),
    });

    const { initializeDatabase, get_config_path } = await import('../store.js');
    
    const configPath = get_config_path(mockApp.getPath('userData'));
    await initializeDatabase(configPath, mockDialog, mockApp);

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      configPath,
      JSON.stringify({ storage_path: '/tmp/userData/database' }, null, 2)
    );
  });

  it('should use an existing config file if one is present', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ storage_path: '/existing/path' }));
    mockConnect.mockResolvedValue({
      tableNames: jest.fn().mockResolvedValue([]),
      createTable: jest.fn().mockResolvedValue({
        delete: jest.fn()
      }),
    });

    const { initializeDatabase, get_config_path } = await import('../store.js');

    const configPath = get_config_path(mockApp.getPath('userData'));
    await initializeDatabase(configPath, mockDialog, mockApp);

    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('should create default storage path when none exists', async () => {
    mockExistsSync.mockReturnValue(false);
    mockConnect.mockResolvedValue({
      tableNames: jest.fn().mockResolvedValue([]),
      createTable: jest.fn().mockResolvedValue({
        delete: jest.fn()
      }),
    });

    const { initializeDatabase, get_config_path } = await import('../store.js');
    
    const configPath = get_config_path(mockApp.getPath('userData'));
    await initializeDatabase(configPath, mockDialog, mockApp);

    expect(mockMkdirSync).toHaveBeenCalledWith('/tmp/userData/database', { recursive: true });
  });
});