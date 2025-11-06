const mongoose = require('mongoose');

// Mock ESM-dependent services before requiring chatbotService
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

const { processAnswerQuery } = require('../services/chatbotService');
const { createActiveBotWithPlan, createClientConfig } = require('./helpers/seed');

// Mocks used by chat service
jest.mock('../services/queryService', () => ({
  retrieveRelevantChunks: jest.fn(async () => [{ content: 'context A' }, { content: 'context B' }]),
}));
jest.mock('../services/chatService', () => ({
  generateAnswer: jest.fn(async () => ({ answer: 'Hello world', tokens: 42 })),
}));
jest.mock('axios', () => ({ post: jest.fn(async () => ({ data: Buffer.from(JSON.stringify({ audio: 'data:audio/wav;base64,' })) })) }));

describe('chatbotService.processAnswerQuery', () => {
  test('returns NEED_AUTH when guest exceeds free messages', async () => {
    const { chatbotId } = await createActiveBotWithPlan();
    await createClientConfig({ chatbot_id: chatbotId, auth_method: 'email', free_messages: 0 });
    const res = await processAnswerQuery({ query: 'hi', chatbotId, sessionId: 's1', email: null, phone: null });
    expect(res.type).toBe('NEED_AUTH');
    expect(res.payload.error).toBe('NEED_AUTH');
  });

  test('happy path returns answer payload with tokens and sessionId', async () => {
    const { chatbotId } = await createActiveBotWithPlan();
    await createClientConfig({ chatbot_id: chatbotId, auth_method: 'email', free_messages: 2 });
    const res = await processAnswerQuery({ query: 'What is your name?', chatbotId, sessionId: 's2', email: 'a@b.com' });
    expect(res.type).toBe('OK');
    expect(res.payload).toHaveProperty('answer');
    expect(res.payload).toHaveProperty('tokens', 42);
    expect(res.payload).toHaveProperty('sessionId');
  });
});
