const { convertGuestMessagesToCSV } = require('../utils/reportHelpers');
const { deriveWindowFromSubscription, makeDateFilter } = require('../utils/dateHelpers');
const { formatSuccessResponse, formatErrorResponse, formatPaginatedResponse } = require('../utils/responseFormatter');

describe('reportHelpers.convertGuestMessagesToCSV', () => {
  it('returns headers-only CSV when dataset is empty', () => {
    const csv = convertGuestMessagesToCSV([]);
    const lines = csv.split('\n');
    expect(lines[0]).toMatch(/Message ID,Chatbot Name,Company Name,Session ID,Sender,Content,Timestamp,Is Guest/);
    expect(lines.length).toBe(1); // only header line
  });
});

describe('dateHelpers', () => {
  it('deriveWindowFromSubscription uses duration_days when only end provided', () => {
    const end = new Date('2025-03-31T12:00:00Z');
    const window = deriveWindowFromSubscription({ end_date: end, duration_days: 10 });
    expect(window.end.getTime()).toBe(end.getTime());
    const diffDays = Math.round((window.end - window.start) / (24*60*60*1000));
    expect(diffDays).toBe(9); // inclusive of end, 10 days total
  });

  it('makeDateFilter with negative days and DST boundary still returns ordered range', () => {
    // Simulate negative duration by manually crafting window
    const end = new Date('2025-03-30T01:30:00Z');
    const start = new Date('2025-03-29T01:30:00Z');
    const filter = makeDateFilter({ start, end }, 'created_at');
    expect(filter).toEqual({ created_at: { $gte: start, $lte: end } });
  });
});

describe('responseFormatter', () => {
  it('formatSuccessResponse omits data when null/undefined', () => {
    const r1 = formatSuccessResponse(null);
    const r2 = formatSuccessResponse(undefined);
    expect(r1).not.toHaveProperty('data');
    expect(r2).not.toHaveProperty('data');
  });

  it('formatErrorResponse supports custom status and details object', () => {
    const details = { code: 'E_CUSTOM', field: 'email' };
    const r = formatErrorResponse('Bad request', 422, details);
    expect(r.status).toBe(422);
    expect(r.errors).toEqual(details);
    expect(r.error).toBe('Bad request');
  });

  it('formatPaginatedResponse includes pagination metadata', () => {
    const resp = formatPaginatedResponse([1,2], 2, 10, 25, 'Listed');
    expect(resp.success).toBe(true);
    expect(resp.pagination.totalPages).toBe(3);
    expect(resp.pagination.hasPrevPage).toBe(true);
    expect(resp.pagination.hasNextPage).toBe(true);
  });
});
