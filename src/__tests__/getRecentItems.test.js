const fs = require('fs');

jest.mock('fs');

describe('getRecentItems', () => {
  it('should return recent items', async () => {
    const mockQuery = {
      toArray: jest.fn().mockResolvedValue([
        { description: 'recent item 2', last_accessed_at: '2024-01-01' },
        { description: 'recent item 1', last_accessed_at: '2024-02-01' },
      ]),
    };
    const mockTable = {
      query: jest.fn().mockReturnValue(mockQuery),
    };
    const mockDb = {
      openTable: jest.fn().mockResolvedValue(mockTable),
    };
    jest.doMock('@lancedb/lancedb', () => ({
      connect: jest.fn().mockResolvedValue(mockDb),
    }));
    fs.readFileSync.mockReturnValue(JSON.stringify({ storage_path: '/test/db' }));

    const { getRecentItems } = require('../store');
    const results = await getRecentItems('/test/config.json');

    expect(results).toHaveLength(2);
    expect(results[0].description).toBe('recent item 1');
  });
});
