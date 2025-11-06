const request = require('supertest');
process.env.NODE_ENV = 'test';
process.env.TEST_ROUTES = '/api/otp';

// Mocks
jest.mock('../services/emailService', () => ({ sendOtpEmail: jest.fn(async () => true) }));
jest.mock('../services/notificationService', () => ({ notifyNewUser: jest.fn(async () => true) }));

const app = require('../app');
const Chatbot = require('../models/Chatbot');
const UserOTPVerification = require('../models/UserOTPVerification');

describe('OTP Routes', () => {
  let chatbotId;
  const email = 'user@test.com';

  beforeAll(async () => {
    const bot = await Chatbot.create({ company_name: 'OTP Co', company_url: 'https://otp.example.com' });
    chatbotId = bot._id.toString();
  });

  afterAll(() => {
    delete process.env.TEST_ROUTES;
  });

  it('request-otp sends email', async () => {
    const res = await request(app)
      .post('/api/otp/request-otp')
      .send({ email });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });

  it('verify-otp validates OTP and returns success', async () => {
    // Seed an OTP record
    await UserOTPVerification.create({ email, otp: '123456' });
    const res = await request(app)
      .post('/api/otp/verify-otp')
      .send({ email, otp: '123456', chatbotId, sessionId: '11111111-1111-4111-8111-111111111111' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('check-session requires params and returns valid=false by default', async () => {
    const missing = await request(app).get('/api/otp/check-session');
    expect(missing.status).toBe(400);

    const res = await request(app)
      .get('/api/otp/check-session')
      .query({ email, chatbotId });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('valid');
  });
});
