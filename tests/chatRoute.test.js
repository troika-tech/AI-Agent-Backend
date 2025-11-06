const request = require('supertest');
process.env.NODE_ENV = 'test';
process.env.TEST_ROUTES = '/api/chat';
require('./helpers/chatMocks');
require('./helpers/productMocks');

// Mocks to isolate chat flow
jest.mock('../services/queryService', () => ({
  retrieveRelevantChunks: jest.fn(async () => [
    { content: 'About Test Co services' },
  ]),
}));

jest.mock('../services/chatService', () => ({
  generateAnswer: jest.fn(async () => ({ answer: 'Hello from mock', tokens: 10 })),
}));




const app = require('../app');
const { createActiveBotWithPlan } = require('./helpers/seed');

describe('Chat Route /api/chat/query', () => {
  let chatbotId;

  beforeAll(async () => {
    const { chatbotId: id } = await createActiveBotWithPlan({ company_name: 'Test Co', company_url: 'https://test.example.com' });
    chatbotId = id;
  });

  afterAll(() => {
    delete process.env.TEST_ROUTES;
  });

  it('returns an answer and sessionId for a basic query', async () => {
    const res = await request(app)
      .post('/api/chat/query')
      .send({ query: 'Hello?', chatbotId });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('answer');
    expect(res.body).toHaveProperty('sessionId');
    expect(res.body.answer).toMatch(/hello/i);
  });
});
