const fs = require('fs');

jest.mock('fs');

describe('searchItems', () => {
  it('returns plain results without vectors', async () => {
    const mockResult = {
      toArray: jest.fn().mockResolvedValue([
        { description: 'found', vector: [1, 2, 3] },
      ]),
    };

    const mockTable = {
      search: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            execute: jest.fn().mockResolvedValue(mockResult),
          }),
        }),
      }),
    };
    const mockDb = { openTable: jest.fn().mockResolvedValue(mockTable) };

    jest.doMock('@lancedb/lancedb', () => ({
      connect: jest.fn().mockResolvedValue(mockDb),
    }));

    const mockEmbedder = jest.fn().mockResolvedValue({ data: [0.1, 0.2] });
    jest.doMock('@xenova/transformers', () => ({
      pipeline: jest.fn().mockResolvedValue(mockEmbedder),
    }));

    fs.readFileSync.mockReturnValue(JSON.stringify({ storage_path: '/test/db' }));

    const { searchItems } = require('../store');
    const res = await searchItems('term', '/test/config.json');

    expect(res).toEqual([{ description: 'found' }]);
  });
});
