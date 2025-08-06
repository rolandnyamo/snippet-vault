import { jest } from '@jest/globals';

// Mock modules globally
const mockReadFileSync = jest.fn();
const mockExistsSync = jest.fn().mockReturnValue(true);
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

// Mock TensorFlow.js embeddings
const mockEmbed = jest.fn().mockResolvedValue({
  data: jest.fn().mockResolvedValue(new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5])),
  dispose: jest.fn(),
});

jest.unstable_mockModule('@tensorflow-models/universal-sentence-encoder', () => ({
  load: jest.fn().mockResolvedValue({
    embed: mockEmbed,
  }),
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
    
    const mockDb = { 
      openTable: jest.fn().mockImplementation((tableName) => {
        if (tableName === 'items_raw') return mockRawTable;
        if (tableName === 'items_embeddings') return mockEmbeddingTable;
      })
    };

    mockConnect.mockResolvedValue(mockDb);
    mockReadFileSync.mockReturnValue(JSON.stringify({ storage_path: '/test/db' }));

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
