import { jest } from '@jest/globals';

// Mock fs 
const mockFs = {
  readFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
};

jest.doMock('fs', () => mockFs);

// Mock lancedb - note: this is a default export mock
const mockDb = { 
  tableNames: jest.fn().mockResolvedValue(['items_raw', 'items_embeddings']),
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

describe('getRecentItems', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return recent items', async () => {
    const mockQueryResult = {
      toArray: jest.fn().mockResolvedValue([
        {
          id: 'item2',
          description: 'recent item 2',
          last_accessed_at: '2024-01-01T00:00:00.000Z',
          payload: 'payload2',
          type: 'text',
          created_at: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'item1', 
          description: 'recent item 1',
          last_accessed_at: '2024-02-01T00:00:00.000Z',
          payload: 'payload1',
          type: 'text',
          created_at: '2024-01-01T00:00:00.000Z',
        },
      ]),
    };
    
    const mockRawTable = {
      query: jest.fn().mockReturnValue(mockQueryResult),
    };
    
    // Mock embedding queries to return current model embeddings (no regeneration needed)
    const mockEmbeddingTable = {
      query: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockImplementation(() => {
          // Return embeddings that match current model so no regeneration is triggered
          return Promise.resolve([{
            id: 'item1',
            embedding_model: 'lightweight-embeddings@1.0.0',
            vector: new Array(256).fill(0.1),
          }]);
        })
      })
    };
    
    mockDb.openTable.mockImplementation((tableName) => {
      if (tableName === 'items_raw') return mockRawTable;
      if (tableName === 'items_embeddings') return mockEmbeddingTable;
    });

    mockFs.readFileSync.mockReturnValue(JSON.stringify({ storage_path: '/test/db' }));

    const { getRecentItems } = await import('../store.js');
    const results = await getRecentItems('/test/config.json');

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      id: 'item1',
      description: 'recent item 1',
      last_accessed_at: '2024-02-01T00:00:00.000Z',
      payload: 'payload1',
      type: 'text',
      created_at: '2024-01-01T00:00:00.000Z',
      embedding_model: 'lightweight-embeddings@1.0.0'
    });
    expect(results[1]).toEqual({
      id: 'item2',
      description: 'recent item 2',
      last_accessed_at: '2024-01-01T00:00:00.000Z',
      payload: 'payload2',
      type: 'text',
      created_at: '2024-01-01T00:00:00.000Z',
      embedding_model: 'lightweight-embeddings@1.0.0'
    });
  });
});
