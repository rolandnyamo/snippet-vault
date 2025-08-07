import { jest } from '@jest/globals';
import path from 'path';

// Mock fs 
const mockFs = {
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
};

jest.doMock('fs', () => mockFs);

// Mock lancedb - note: this is a default export mock
const mockDb = { 
  tableNames: jest.fn().mockResolvedValue([]),
  createTable: jest.fn().mockResolvedValue({
    delete: jest.fn()
  }),
};

const mockLancedb = {
  connect: jest.fn().mockResolvedValue(mockDb),
};

jest.doMock('@lancedb/lancedb', () => mockLancedb);

// Mock the hybrid embedding system
const mockEmbeddingManager = {
  initialize: jest.fn().mockResolvedValue(),
  generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]),
  getCurrentModelType: jest.fn().mockReturnValue('lightweight'),
  getCurrentDimensions: jest.fn().mockReturnValue(256),
  isInitialized: jest.fn().mockReturnValue(true),
  setModelType: jest.fn().mockResolvedValue(),
  canLoadTensorFlow: jest.fn().mockResolvedValue(false),
};

jest.doMock('../hybrid-embeddings.js', () => ({
  embeddingManager: mockEmbeddingManager,
  EMBEDDING_MODELS: {
    LIGHTWEIGHT: 'lightweight',
    TENSORFLOW: 'tensorflow'
  }
}));

// Mock apache-arrow
jest.doMock('apache-arrow', () => ({
  default: {},
}));

const mockDialog = {
  showOpenDialog: jest.fn(),
  showMessageBox: jest.fn().mockResolvedValue({ response: 0 }), // Mock return value
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
    mockFs.existsSync.mockReturnValue(false);

    const { initializeDatabase, get_config_path } = await import('../store.js');
    
    const configPath = get_config_path(mockApp.getPath('userData'));
    await initializeDatabase(configPath, mockDialog, mockApp);

    const expectedStoragePath = path.join(mockApp.getPath('userData'), 'database');
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      configPath,
      JSON.stringify({ storage_path: expectedStoragePath }, null, 2)
    );
  });

  it('should use an existing config file if one is present', async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ storage_path: '/existing/path' }));

    const { initializeDatabase, get_config_path } = await import('../store.js');

    const configPath = get_config_path(mockApp.getPath('userData'));
    await initializeDatabase(configPath, mockDialog, mockApp);

    expect(mockFs.writeFileSync).not.toHaveBeenCalled();
  });

  it('should create default storage path when none exists', async () => {
    mockFs.existsSync.mockReturnValue(false);

    const { initializeDatabase, get_config_path } = await import('../store.js');
    
    const configPath = get_config_path(mockApp.getPath('userData'));
    await initializeDatabase(configPath, mockDialog, mockApp);

    const expectedStoragePath = path.join(mockApp.getPath('userData'), 'database');
    expect(mockFs.mkdirSync).toHaveBeenCalledWith(expectedStoragePath, { recursive: true });
  });
});