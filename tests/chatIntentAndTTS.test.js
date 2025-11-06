const request = require('supertest');
process.env.NODE_ENV = 'test';
process.env.TEST_ROUTES = '/api/chat';
require('./helpers/chatMocks');
require('./helpers/productMocks');

// Common mocks for chat flow (stable mocks; tweak implementations per test as needed)
jest.mock('../services/queryService', () => ({
  retrieveRelevantChunks: jest.fn(async () => [{ content: 'company info' }]),
}));

jest.mock('../services/chatService', () => ({
  generateAnswer: jest.fn(async () => ({ answer: 'Base answer', tokens: 7 })),
}));


// Config and axios default mocks are centralized in tests/setup.js; we override per test as needed

const app = require('../app');
const { createActiveBotWithPlan } = require('./helpers/seed');

describe('Chat: intent link insertion and TTS failure', () => {
  let chatbotId;

  beforeEach(async () => {
    const { chatbotId: id } = await createActiveBotWithPlan({ company_name: 'Link Co', company_url: 'https://link.example.com' });
    chatbotId = id;
  });

  afterAll(() => {
    delete process.env.TEST_ROUTES;
  });

  it('inserts intent link when keyword matches', async () => {
    const { getClientConfig } = require('../services/configService');
    const axios = require('axios');
    // Update mocks for this test
    getClientConfig.mockResolvedValue({
      auth_method: 'email',
      free_messages: 5,
      require_auth_text: 'Sign in to continue.',
      link_intents: [
        { intent: 'pricing', keywords: ['pricing', 'cost'], link: 'https://example.com/pricing' },
      ],
      product_enabled: false,
    });
    axios.post.mockResolvedValue({ data: Buffer.from(JSON.stringify({ audio: 'data:audio/wav;base64,' })) });

    const res = await request(app)
      .post('/api/chat/query')
      .send({ query: 'What is your pricing?', chatbotId, email: 'user@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.answer).toMatch(/Click here for more info/);
    expect(res.body.answer).toMatch(/https:\/\/example\.com\/pricing/);
  });

  it('returns 200 without audio when TTS fails', async () => {
    const { getClientConfig } = require('../services/configService');
    const axios = require('axios');
    // Default cfg, but ensure no intents
    getClientConfig.mockResolvedValue({
      auth_method: 'email',
      free_messages: 5,
      require_auth_text: 'Sign in to continue.',
      link_intents: [],
      product_enabled: false,
    });
    // Force TTS failure
    axios.post.mockRejectedValue(new Error('TTS down'));

    const res = await request(app)
      .post('/api/chat/query')
      .send({ query: 'Hello without audio', chatbotId, email: 'user@example.com' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('audio');
    expect(res.body.audio).toBeNull();
  });
});
