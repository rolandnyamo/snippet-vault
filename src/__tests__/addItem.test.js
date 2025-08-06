const fs = require('fs');

jest.mock('fs');
jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn().mockResolvedValue(
    jest.fn().mockResolvedValue({ data: [0.1, 0.2, 0.3] })
  ),
}));

describe('addItem', () => {
  it('should add an item to the database', async () => {
    const mockTable = {
      add: jest.fn(),
    };
    const mockDb = {
      openTable: jest.fn().mockResolvedValue(mockTable),
    };
    jest.doMock('@lancedb/lancedb', () => ({
      connect: jest.fn().mockResolvedValue(mockDb),
    }));
    fs.readFileSync.mockReturnValue(JSON.stringify({ storage_path: '/test/db' }));

    const { addItem } = require('../store');
    const item = {
      type: 'link',
      payload: 'https://example.com',
      description: 'An example link',
    };

    await addItem(item, '/test/config.json');

    expect(mockTable.add).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'link',
        payload: 'https://example.com',
        description: 'An example link',
        vector: [0.1, 0.2, 0.3],
      }),
    ]);
  });
});