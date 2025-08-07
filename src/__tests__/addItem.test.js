import { jest } from '@jest/globals';

// Mock fs 
const mockFs = {
  readFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  rmSync: jest.fn(), // Add rmSync for nuclear rebuild
};

jest.doMock('fs', () => mockFs);

// Mock lancedb 
const mockDb = { 
  openTable: jest.fn()
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

// Mock uuid
jest.doMock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid-123'),
}));

describe('addItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should add an item to the database', async () => {
    const mockQuery = {
      limit: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue([])
    };
    
    const mockRawTable = {
      add: jest.fn(),
      query: jest.fn().mockReturnValue(mockQuery),
    };
    
    const mockEmbeddingTable = {
      add: jest.fn(),
      query: jest.fn().mockReturnValue(mockQuery),
    };
    
    mockDb.openTable.mockImplementation((tableName) => {
      if (tableName === 'items_raw') return mockRawTable;
      if (tableName === 'items_embeddings') return mockEmbeddingTable;
    });

    mockFs.readFileSync.mockReturnValue(JSON.stringify({ storage_path: '/test/db' }));

    const { addItem } = await import('../store.js');
    const item = {
      type: 'link',
      payload: 'https://example.com',
      description: 'An example link',
    };

    await addItem(item, '/test/config.json');

    // Check that raw table was called
    expect(mockRawTable.add).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'test-uuid-123',
        type: 'link',
        payload: 'https://example.com',
        description: 'An example link',
        created_at: expect.any(String),
        last_accessed_at: expect.any(String),
      }),
    ]);
    
    // Check that embedding table was called with lightweight model
    expect(mockEmbeddingTable.add).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'test-uuid-123',
        embedding_model: 'lightweight-embeddings@1.0.0',
        vector: [0.1, 0.2, 0.3, 0.4, 0.5],
        created_at: expect.any(String),
      }),
    ]);
  });
});