const request = require('supertest');
// Ensure route selection is configured before loading the app
process.env.NODE_ENV = 'test';
process.env.TEST_ROUTES = '/api/suggestions';
const app = require('../app');
const ClientConfig = require('../models/ClientConfig');
const Chatbot = require('../models/Chatbot');

describe('Suggestions Routes', () => {
  let chatbotId;

  beforeAll(async () => {
    const bot = await Chatbot.create({
      company_name: 'Test Co',
      company_url: 'https://test.example.com',
    });
    chatbotId = bot._id.toString();
  });

  afterAll(() => {
    delete process.env.TEST_ROUTES;
  });

  it('GET /api/suggestions/:chatbotId -> [] when not set', async () => {
    const res = await request(app).get(`/api/suggestions/${chatbotId}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST /api/suggestions/:chatbotId -> upsert suggestions', async () => {
    const payload = { suggestions: [
      { label: 'Hi', icon: 'FaSmile', bg: '#10b981' },
      { label: 'Help', icon: 'FaQuestion', bg: '#3b82f6' },
      { label: 'Pricing?', icon: 'FaDollarSign', bg: '#f59e0b' },
    ] };
    const res = await request(app).post(`/api/suggestions/${chatbotId}`).send(payload);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  expect(Array.isArray(res.body.ui_suggestions)).toBe(true);
  // Compare labels only for brevity
  expect(res.body.ui_suggestions.map(x => x.label)).toEqual(payload.suggestions.map(x => x.label));

    // Verify in DB
    const doc = await ClientConfig.findOne({ chatbot_id: chatbotId });
  expect(doc).toBeTruthy();
  expect(doc.ui_suggestions.map(x => x.label)).toEqual(payload.suggestions.map(x => x.label));
  });

  it('PUT /api/suggestions/:chatbotId -> update existing suggestions only', async () => {
    // Arrange: ensure a config exists (DB is cleared between tests)
    await ClientConfig.create({
      chatbot_id: chatbotId,
      ui_suggestions: [
        { label: 'Old', icon: 'FaHistory', bg: '#9ca3af' },
      ],
    });

    const newSuggestions = [
      { label: 'Contact', icon: 'FaPhone', bg: '#10b981' },
      { label: 'Support', icon: 'FaLifeRing', bg: '#ef4444' },
    ];
    const res = await request(app)
      .put(`/api/suggestions/${chatbotId}`)
      .send({ suggestions: newSuggestions });
    expect(res.status).toBe(200);
    expect(res.body.ui_suggestions.map(x => x.label)).toEqual(newSuggestions.map(x => x.label));

    const doc = await ClientConfig.findOne({ chatbot_id: chatbotId });
    expect(doc.ui_suggestions.map(x => x.label)).toEqual(newSuggestions.map(x => x.label));
  });
});
