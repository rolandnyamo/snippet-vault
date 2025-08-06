const fs = require('fs');

jest.mock('fs');

describe('getRecentItems', () => {
  it('should return recent items', async () => {
    const mockTable = {
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue([
        { description: 'recent item 1' },
        { description: 'recent item 2' },
      ]),
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
