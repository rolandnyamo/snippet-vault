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

// Mock uuid
jest.doMock('uuid', () => ({
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