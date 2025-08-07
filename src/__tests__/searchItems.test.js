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
  openTable: jest.fn()
};

const mockLancedb = {
  connect: jest.fn().mockResolvedValue(mockDb),
};

jest.doMock('@lancedb/lancedb', () => mockLancedb);

// Mock TensorFlow.js embeddings  
const mockEmbedding = {
  data: jest.fn().mockResolvedValue(new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5])),
  dispose: jest.fn(),
};

const mockModel = {
  embed: jest.fn().mockResolvedValue(mockEmbedding),
};

jest.doMock('@tensorflow-models/universal-sentence-encoder', () => ({
  load: jest.fn().mockResolvedValue(mockModel),
}));

describe('searchItems', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns plain results without vectors', async () => {
    const mockRawQueryResult = {
      toArray: jest.fn().mockResolvedValue([
        { 
          id: 'item1',
          description: 'found',
          payload: 'test payload',
          type: 'text',
          created_at: '2024-01-01T00:00:00.000Z',
          last_accessed_at: '2024-01-01T00:00:00.000Z',
        }
      ]),
    };
    
    const mockVectorSearchResult = [
      {
        id: 'item1',
        embedding_model: 'tensorflow/universal-sentence-encoder@3.3.0',
        vector: [0.1, 0.2, 0.3],
      }
    ];
    
    const mockEmbeddingQueryResult = {
      toArray: jest.fn().mockResolvedValue([{
        id: 'item1',
        embedding_model: 'tensorflow/universal-sentence-encoder@3.3.0'
      }])
    };
    
    const mockRawTable = {
      query: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue(mockRawQueryResult)
      })
    };
    
    const mockEmbeddingTable = {
      query: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue(mockEmbeddingQueryResult)
      }),
      search: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue(mockVectorSearchResult),
        }),
      }),
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
        description: 'found',
        payload: 'test payload',
        type: 'text',
        created_at: '2024-01-01T00:00:00.000Z',
        last_accessed_at: '2024-01-01T00:00:00.000Z',
        embedding_model: 'tensorflow/universal-sentence-encoder@3.3.0'
      }
    ]);
  });
});
