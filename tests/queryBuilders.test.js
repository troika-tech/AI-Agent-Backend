const { buildDateRangeFilter } = require('../utils/queryBuilders');

describe('queryBuilders.buildDateRangeFilter', () => {
  test('returns empty object when no dates provided', () => {
    expect(buildDateRangeFilter({})).toEqual({});
  });

  test('builds $gte only when startDate provided', () => {
    const start = '2025-01-01T00:00:00Z';
    const q = buildDateRangeFilter({ startDate: start });
    expect(q).toHaveProperty('timestamp.$gte');
    expect(new Date(q.timestamp.$gte).getTime()).toBe(new Date(start).getTime());
  });

  test('builds $lte only when endDate provided', () => {
    const end = '2025-02-01T00:00:00Z';
    const q = buildDateRangeFilter({ endDate: end });
    expect(q).toHaveProperty('timestamp.$lte');
    expect(new Date(q.timestamp.$lte).getTime()).toBe(new Date(end).getTime());
  });

  test('builds both $gte and $lte when both provided', () => {
    const start = '2025-01-01T00:00:00Z';
    const end = '2025-02-01T00:00:00Z';
    const q = buildDateRangeFilter({ startDate: start, endDate: end });
    expect(new Date(q.timestamp.$gte).getTime()).toBe(new Date(start).getTime());
    expect(new Date(q.timestamp.$lte).getTime()).toBe(new Date(end).getTime());
  });

  test('supports custom field name', () => {
    const start = '2025-03-01T00:00:00Z';
    const q = buildDateRangeFilter({ startDate: start }, 'created_at');
    expect(q).toHaveProperty('created_at.$gte');
  });
});
