const fs = require('fs');

jest.mock('fs');
jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn().mockResolvedValue(
    jest.fn().mockResolvedValue({ data: [0.1, 0.2, 0.3] })
  ),
}));

describe('searchItems', () => {
  it('should return search results', async () => {
    const mockTable = {
      search: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue([
        { description: 'test item 1' },
        { description: 'test item 2' },
      ]),
    };
    const mockDb = {
      openTable: jest.fn().mockResolvedValue(mockTable),
    };
    jest.doMock('@lancedb/lancedb', () => ({
      connect: jest.fn().mockResolvedValue(mockDb),
    }));
    fs.readFileSync.mockReturnValue(JSON.stringify({ storage_path: '/test/db' }));

    const { searchItems } = require('../store');
    const results = await searchItems('test', '/test/config.json');

    expect(results).toHaveLength(2);
    expect(results[0].description).toBe('test item 1');
  });
});
