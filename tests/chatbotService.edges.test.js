// Focused unit tests with mocks for external deps
jest.mock('../services/queryService', () => ({
  retrieveRelevantChunks: jest.fn(async () => []), // empty context path
}));
jest.mock('../services/chatService', () => ({
  generateAnswer: jest.fn(async () => ({ answer: 'Base answer', tokens: 7 })),
}));
jest.mock('../services/configService', () => ({
  getClientConfig: jest.fn(async () => ({ auth_method: 'email', free_messages: 1, require_auth_text: 'Sign in', product_enabled: false, link_intents: [{ pattern: 'help', url: 'https://docs' }] })),
}));
jest.mock('../services/productIntentService', () => ({
  isProductQuery: jest.fn(async () => false),
  extractProductFilters: jest.fn(async () => ({})),
}));
jest.mock('../services/productSearchService', () => ({
  searchProducts: jest.fn(),
}));
jest.mock('axios');

const axios = require('axios');
const { processAnswerQuery } = require('../services/chatbotService');
const { createActiveBotWithPlan } = require('./helpers/seed');

describe('chatbotService edge branches', () => {
  beforeEach(() => {
    axios.post.mockReset();
    // TTS success but empty audio
    axios.post.mockResolvedValue({ data: Buffer.from(JSON.stringify({ audio: 'data:audio/wav;base64,' })) });
  });

  it('handles feature flag off and empty context', async () => {
    const { chatbotId } = await createActiveBotWithPlan();
    const res = await processAnswerQuery({ query: 'help me', chatbotId, sessionId: '11111111-1111-4111-8111-111111111111', email: 'a@b.com' });
    expect(res.type).toBe('OK');
    expect(res.payload).toHaveProperty('answer');
    // from empty context path, chatService still returns Base answer
    expect(res.payload.answer).toMatch(/answer/i);
  });

  it('continues when TTS provider errors', async () => {
    const { chatbotId } = await createActiveBotWithPlan();
    axios.post.mockRejectedValueOnce(new Error('Provider down'));
    const res = await processAnswerQuery({ query: 'hello', chatbotId, sessionId: '11111111-1111-4111-8111-111111111111', email: 'a@b.com' });
    expect(res.type).toBe('OK');
    expect(res.payload.audio).toBeNull();
  });
});
