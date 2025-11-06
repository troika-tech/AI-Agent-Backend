const request = require('supertest');
process.env.NODE_ENV = 'test';
process.env.TEST_ROUTES = '/api/chat';

// Keep chatService real; mock axios (OpenAI + TTS) and turn off product features
jest.mock('axios');
const axios = require('axios');

jest.mock('../services/productIntentService', () => ({
  isProductQuery: jest.fn(async () => false),
  extractProductFilters: jest.fn(async () => ({})),
}));
jest.mock('../services/productSearchService', () => ({ searchProducts: jest.fn(async () => ({ results: [] })) }));

jest.mock('../services/configService', () => ({
  getClientConfig: jest.fn(async () => ({ auth_method: 'email', free_messages: 10, link_intents: [], product_enabled: false })),
}));

// Deterministic context
jest.mock('../services/queryService', () => ({
  retrieveRelevantChunks: jest.fn(async () => [
    { content: 'Supa Agent provides friendly assistance and details.' },
    { content: 'Use concise explanations unless asked for more details.' },
  ]),
}));

const app = require('../app');
const { getClientConfig } = require('../services/configService');
const { createActiveBotWithPlan } = require('./helpers/seed');

describe('chatService via /api/chat/query (Option B)', () => {
  let chatbotId;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Fresh active bot + subscription each test (DB is cleared after each test globally)
    const seeded = await createActiveBotWithPlan({ company_name: 'Svc Co', company_url: 'https://svc.example.com' });
    chatbotId = seeded.chatbotId;
    axios.post.mockImplementation(async (url, body) => {
      if (typeof url === 'string' && url.includes('openai.com')) {
        return { data: { choices: [{ message: { content: 'This is a concise answer.' } }], usage: { total_tokens: 11 } } };
      }
      // TTS returns valid audio
      return { data: Buffer.from(JSON.stringify({ audio: 'data:audio/wav;base64,AAAA' })) };
    });
  });

  afterAll(() => {
    delete process.env.TEST_ROUTES;
  });

  it('returns an answer and tokens via real chatService path', async () => {
    const res = await request(app)
      .post('/api/chat/query')
      .send({ query: 'Tell me about your service', chatbotId, sessionId: '11111111-1111-4111-8111-111111111111', email: 'user@example.com' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('answer');
    expect(res.body).toHaveProperty('tokens', 11);
    expect(res.body).toHaveProperty('sessionId');
  });

  it('gracefully handles TTS provider error (still 200 without audio)', async () => {
    axios.post.mockImplementation(async (url, body) => {
      if (typeof url === 'string' && url.includes('openai.com')) {
        return { data: { choices: [{ message: { content: 'Another answer.' } }], usage: { total_tokens: 9 } } };
      }
      throw new Error('TTS outage');
    });

    // Ensure auth is email and generous free messages to avoid any gating
    getClientConfig.mockResolvedValue({ auth_method: 'email', free_messages: 100, link_intents: [], product_enabled: false });

    const res = await request(app)
      .post('/api/chat/query')
      .send({ query: 'More detail please', chatbotId, sessionId: '11111111-1111-4111-8111-111111111111', email: 'user@example.com' });
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('answer');
  expect(res.body.audio).toBeNull();
  });
});
