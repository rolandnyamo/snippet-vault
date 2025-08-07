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

describe('searchItems', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns plain results without vectors', async () => {
    // Mock for the compatibility check query and embedding current queries
    const mockQueryWithWhere = {
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockImplementation(() => {
        // Check if this is a specific ID query (has where clause)
        const whereCall = mockQueryWithWhere.where.mock.calls.find(call => 
          call[0] && call[0].includes('id =')
        );
        
        if (whereCall) {
          // Return specific embedding for this item
          return Promise.resolve([{
            id: 'item1',
            embedding_model: 'lightweight-embeddings@1.0.0',  // Match current model
            vector: new Array(256).fill(0.1),
          }]);
        } else {
          // Return compatibility check result
          return Promise.resolve([{
            id: 'embedding1',
            embedding_model: 'lightweight-embeddings@1.0.0',  // Match current model
            vector: new Array(256).fill(0.1), // 256 dimensions to match
          }]);
        }
      })
    };

    // Mock for vector search results
    const mockVectorSearch = {
      limit: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue([
        {
          id: 'item1',
          _distance: 0.2
        }
      ])
    };

    // Mock for raw item fetch
    const mockRawQuery = {
      where: jest.fn().mockReturnThis(),
      toArray: jest.fn().mockResolvedValue([
        {
          id: 'item1',
          description: 'found item',
          payload: 'test payload',
          type: 'link',
          created_at: '2023-01-01T00:00:00.000Z',
          last_accessed_at: '2023-01-01T00:00:00.000Z',
        }
      ])
    };
    
    const mockEmbeddingTable = {
      query: jest.fn().mockReturnValue(mockQueryWithWhere),
      search: jest.fn().mockReturnValue(mockVectorSearch),
    };
    
    const mockRawTable = {
      query: jest.fn().mockReturnValue(mockRawQuery),
    };
    
    mockDb.openTable.mockImplementation((tableName) => {
      if (tableName === 'items_raw') return mockRawTable;
      if (tableName === 'items_embeddings') return mockEmbeddingTable;
    });

    mockFs.readFileSync.mockReturnValue(JSON.stringify({ storage_path: '/test/db' }));

    const { searchItems } = await import('../store.js');
    const res = await searchItems('found', '/test/config.json');

    expect(res).toEqual([
      { 
        id: 'item1',
        description: 'found item',
        payload: 'test payload',
        type: 'link',
        created_at: '2023-01-01T00:00:00.000Z',
        last_accessed_at: '2023-01-01T00:00:00.000Z',
        embedding_model: 'lightweight-embeddings@1.0.0',
      }
    ]);
    
    // Verify the embedding generation was called
    expect(mockEmbeddingManager.generateEmbedding).toHaveBeenCalledWith('found');
  });
});
