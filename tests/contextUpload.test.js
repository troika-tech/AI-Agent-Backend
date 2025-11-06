const request = require('supertest');
const { adminToken } = require('./helpers/jwt');
process.env.NODE_ENV = 'test';
process.env.TEST_ROUTES = '/api/context';

// Mock extract and store services
jest.mock('../utils/extractTextFromFile', () => jest.fn(async () => 'Sample text content.'));
jest.mock('../utils/chunkText', () => jest.fn((txt) => ['chunk1', 'chunk2']));
jest.mock('../services/contextService', () => ({
  storeContextChunks: jest.fn(async (chunks, chatbotId) => chunks.map((c, i) => ({ content: c, chatbot_id: chatbotId, i }))),
}));

const app = require('../app');
const Chatbot = require('../models/Chatbot');
const path = require('path');

describe('Context Upload', () => {
  let chatbotId;

  beforeAll(async () => {
    const bot = await Chatbot.create({ company_name: 'Ctx Co', company_url: 'https://ctx.example.com' });
    chatbotId = bot._id.toString();
  });

  afterAll(() => {
    delete process.env.TEST_ROUTES;
  });

  it('uploads a file and stores chunks', async () => {
  const token = adminToken({ id: 'u1', email: 'admin@test.com' });
    const res = await request(app)
      .post('/api/context/upload-file')
      .set('Authorization', `Bearer ${token}`)
      .field('chatbotId', chatbotId)
      .attach('file', Buffer.from('dummy'), { filename: 'sample.txt', contentType: 'text/plain' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('chunksStored');
    expect(res.body.chunksStored).toBeGreaterThan(0);
  });
});
