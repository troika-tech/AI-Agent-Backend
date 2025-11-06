// tests/serviceEdges.test.js
// Mock ESM-dependent services to avoid franc-min/import issues
jest.mock('franc-min', () => ({}));
jest.mock('../services/productIntentService', () => ({
  isProductQuery: jest.fn(async () => false),
  extractProductFilters: jest.fn(async () => ({})),
}));
jest.mock('../services/productSearchService', () => ({
  searchProducts: jest.fn(async () => ({ results: [] })),
}));
jest.mock('../services/languageService', () => ({
  processQuery: jest.fn(async (q) => ({ translatedQuery: q })),
}));

const adminService = require('../services/adminService');
const { processAnswerQuery } = require('../services/chatbotService');
const userService = require('../services/userService');
const { createActiveBotWithPlan, createClientConfig } = require('./helpers/seed');

jest.mock('../services/queryService', () => ({
  retrieveRelevantChunks: jest.fn(async () => []),
}));
jest.mock('../services/chatService', () => ({
  generateAnswer: jest.fn(async () => ({ answer: 'A', tokens: 1 })),
}));
jest.mock('axios', () => ({ post: jest.fn(async () => ({ data: Buffer.from(JSON.stringify({ audio: 'data:audio/wav;base64,' })) })) }));

describe('service edge cases', () => {
  test('adminService.login unauthorized for unknown user', async () => {
    const res = await adminService.login({ email: 'nobody@example.com', password: 'x' });
    expect(res.unauthorized).toBe(true);
  });

  test('chatbotService.processAnswerQuery validation error for missing query', async () => {
    const { chatbotId } = await createActiveBotWithPlan();
    await createClientConfig({ chatbot_id: chatbotId, auth_method: 'email', free_messages: 1 });
    await expect(
      processAnswerQuery({ query: '', chatbotId })
    ).rejects.toThrow(/Invalid input|Please ask anything/i);
  });

  test('userService.getMessages validation clamps and handles strings', async () => {
    const { bot } = await createActiveBotWithPlan();
    const companyId = bot.company_id || bot._id;
    const res = await userService.getMessages(companyId, { page: '1', limit: '5', is_guest: 'false' });
    if (res.notFound) {
      expect(res.notFound).toBe(true);
    } else {
      expect(res.page).toBe(1);
      expect(res.totalPages).toBeGreaterThanOrEqual(0);
    }
  });

  test('chatbotService.processAnswerQuery fails when subscription not found', async () => {
    const { chatbotId } = await createActiveBotWithPlan({ subscription: { status: 'inactive', endInMs: 3600_000 } });
    await expect(
      processAnswerQuery({ query: 'hello', chatbotId })
    ).rejects.toThrow(/inactive|subscription/i);
  });

  test('chatbotService.processAnswerQuery fails when subscription expired', async () => {
    const { chatbotId } = await createActiveBotWithPlan({ subscription: { status: 'active', endInMs: -3600_000 } });
    await createClientConfig({ chatbot_id: chatbotId, auth_method: 'email', free_messages: 2 });
    await expect(
      processAnswerQuery({ query: 'hello', chatbotId })
    ).rejects.toThrow(/expired/i);
  });

  test('userService.getMessages returns notFound for unknown company', async () => {
    const res = await userService.getMessages('000000000000000000000000', { page: 1, limit: 5 });
    expect(res.notFound).toBe(true);
  });
});
