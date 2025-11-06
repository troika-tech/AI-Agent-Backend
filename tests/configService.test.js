jest.mock('../models/ClientConfig', () => ({ findOne: jest.fn() }));
const ClientConfig = require('../models/ClientConfig');
const { getClientConfig } = require('../services/configService');

function mockFindOneReturn(docOrNull) {
  ClientConfig.findOne.mockReturnValue({
    lean: jest.fn().mockResolvedValue(docOrNull),
  });
}

describe('configService.getClientConfig normalization', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns safe defaults when no config found', async () => {
    mockFindOneReturn(null);
    const cfg = await getClientConfig('000000000000000000000001');
    expect(cfg).toEqual({
      auth_method: 'email',
      free_messages: 1,
      require_auth_text: 'Sign in to continue.',
      link_intents: [],
      ui_suggestions: [],
    });
  });

  it('normalizes auth_method and clamps free_messages', async () => {
    mockFindOneReturn({
      auth_method: 'Both',
      free_messages: 999,
      require_auth_text: '  Login please  ',
      link_intents: [{ intent: 'pricing', keywords: ['price'], link: 'x' }],
      ui_suggestions: [{ label: 'Hi', icon: 'FaSmile', bg: '#10b981' }],
    });
    const cfg = await getClientConfig('000000000000000000000002');
    expect(cfg.auth_method).toBe('both');
    expect(cfg.free_messages).toBeGreaterThanOrEqual(0);
    expect(cfg.free_messages).toBeLessThanOrEqual(5);
    expect(cfg.require_auth_text).toBe('Login please');
    expect(Array.isArray(cfg.link_intents)).toBe(true);
    expect(Array.isArray(cfg.ui_suggestions)).toBe(true);
  });

  it('handles errors by returning defaults', async () => {
    ClientConfig.findOne.mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error('DB down')),
    });
    const cfg = await getClientConfig('000000000000000000000003');
    expect(cfg.auth_method).toBe('email');
    expect(cfg.free_messages).toBe(1);
  });

  it('falls back to email on invalid auth_method', async () => {
    mockFindOneReturn({ auth_method: 'telegram', free_messages: 2 });
    const cfg = await getClientConfig('000000000000000000000004');
    expect(cfg.auth_method).toBe('email');
    expect(cfg.free_messages).toBe(2);
  });

  it('parses and clamps free_messages when negative or non-number', async () => {
    mockFindOneReturn({ auth_method: 'whatsapp', free_messages: '-3' });
    const cfg1 = await getClientConfig('000000000000000000000005');
    expect(cfg1.auth_method).toBe('whatsapp');
    expect(cfg1.free_messages).toBe(0);

    mockFindOneReturn({ auth_method: 'both', free_messages: 'NaN' });
    const cfg2 = await getClientConfig('000000000000000000000006');
    expect(cfg2.auth_method).toBe('both');
    expect(cfg2.free_messages).toBe(1);
  });
});
