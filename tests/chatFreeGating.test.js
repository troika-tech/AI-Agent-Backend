const request = require('supertest');
process.env.NODE_ENV = 'test';
process.env.TEST_ROUTES = '/api/chat';
require('./helpers/chatMocks');
require('./helpers/productMocks');
const { getClientConfig } = require('../services/configService');

// Mocks to isolate chat flow
jest.mock('../services/queryService', () => ({
  retrieveRelevantChunks: jest.fn(async () => [{ content: 'ctx' }]),
}));

jest.mock('../services/chatService', () => ({
  generateAnswer: jest.fn(async () => ({ answer: 'Hello', tokens: 5 })),
}));




const app = require('../app');
const { createActiveBotWithPlan } = require('./helpers/seed');

describe('Chat free message gating', () => {
  let chatbotId;
  let sessionId;

  beforeAll(async () => {
    // Ensure only 1 free message for this test to trigger NEED_AUTH on second
    getClientConfig.mockResolvedValue({
      auth_method: 'email',
      free_messages: 1,
      require_auth_text: 'Sign in to continue.',
      link_intents: [],
      product_enabled: false,
    });
    const { chatbotId: id } = await createActiveBotWithPlan({ company_name: 'Gate Co', company_url: 'https://gate.example.com' });
    chatbotId = id;
    // Use a valid UUID v4 for sessionId to pass validation
    sessionId = '11111111-1111-4111-8111-111111111111';
  });

  afterAll(() => {
    delete process.env.TEST_ROUTES;
  });

  it('allows first guest message, then returns NEED_AUTH on second', async () => {
    // First message (guest, no email) should pass (free_messages = 1)
    const first = await request(app)
      .post('/api/chat/query')
      .send({ query: 'Hello 1', chatbotId, sessionId });
    expect(first.status).toBe(200);

    // Second message, still guest -> should hit gating and require auth
    const second = await request(app)
      .post('/api/chat/query')
      .send({ query: 'Hello 2', chatbotId, sessionId });
    expect(second.status).toBe(403);
    expect(second.body.error).toBe('NEED_AUTH');
    expect(second.body.auth_method).toBe('email');
  });
});
