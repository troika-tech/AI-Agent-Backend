const { pick, normEmail, normPhone } = require('../utils/objectHelpers');
const { convertGuestMessagesToCSV } = require('../utils/reportHelpers');

describe('utils helpers', () => {
  test('objectHelpers.pick selects allowed keys', () => {
    const obj = { a: 1, b: 2, c: 3 };
    expect(pick(obj, ['a','c'])).toEqual({ a: 1, c: 3 });
    expect(pick(undefined, ['a'])).toEqual({});
  });

  test('objectHelpers.normEmail and normPhone', () => {
    expect(normEmail('  User@Example.com ')).toBe('user@example.com');
    expect(normEmail('')).toBeUndefined();
    expect(normPhone(' +1 234 567 ')).toBe('+1234567');
    expect(normPhone('')).toBeUndefined();
  });

  test('reportHelpers.convertGuestMessagesToCSV basic format', () => {
    const messages = [
      { _id: { toString: () => '1' }, chatbot_id: { name: 'Bot', company_id: { name: 'Co' } }, session_id: 's', sender: 'user', content: 'hi', timestamp: new Date('2025-01-01T00:00:00Z'), is_guest: true },
    ];
    const csv = convertGuestMessagesToCSV(messages);
    expect(csv).toMatch(/Message ID,Chatbot Name,Company Name/);
    expect(csv).toMatch(/1,Bot,Co/);
  });
});
