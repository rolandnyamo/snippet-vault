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
    
    const mockEmbeddingTable = {
      query: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([{
            id: 'item1',
            embedding_model: 'tensorflow/universal-sentence-encoder@3.3.0'
          }])
        })
      })
    };
    
    const mockDb = { 
      tableNames: jest.fn().mockResolvedValue(['items_raw', 'items_embeddings']),
      openTable: jest.fn().mockImplementation((tableName) => {
        if (tableName === 'items_raw') return mockRawTable;
        if (tableName === 'items_embeddings') return mockEmbeddingTable;
      })
    };

    mockConnect.mockResolvedValue(mockDb);
    mockReadFileSync.mockReturnValue(JSON.stringify({ storage_path: '/test/db' }));

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
      embedding_model: 'tensorflow/universal-sentence-encoder@3.3.0'
    });
    expect(results[1]).toEqual({
      id: 'item2',
      description: 'recent item 2',
      last_accessed_at: '2024-01-01T00:00:00.000Z',
      payload: 'payload2',
      type: 'text',
      created_at: '2024-01-01T00:00:00.000Z',
      embedding_model: 'unknown'
    });
  });
});
