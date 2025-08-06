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

jest.unstable_mockModule('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid-123'),
}));

describe('addItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should add an item to the database', async () => {
    const mockRawTable = {
      add: jest.fn(),
    };
    
    const mockEmbeddingTable = {
      add: jest.fn(),
    };
    
    const mockDb = {
      openTable: jest.fn().mockImplementation((tableName) => {
        if (tableName === 'items_raw') return mockRawTable;
        if (tableName === 'items_embeddings') return mockEmbeddingTable;
      })
    };

    mockConnect.mockResolvedValue(mockDb);
    mockReadFileSync.mockReturnValue(JSON.stringify({ storage_path: '/test/db' }));

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
    
    // Check that embedding table was called
    expect(mockEmbeddingTable.add).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'test-uuid-123',
        embedding_model: 'tensorflow/universal-sentence-encoder@3.3.0',
        vector: expect.any(Array),
        created_at: expect.any(String),
      }),
    ]);
  });
});