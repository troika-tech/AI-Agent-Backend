const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// franc-min is ESM and causes parse issues under Jest CJS; stub it globally for tests
jest.mock('franc-min', () => ({ franc: jest.fn(() => 'eng') }));

beforeAll(async () => {
  // Start in-memory Mongo and connect Mongoose
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  process.env.MONGODB_URI = uri;
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';

  await mongoose.connect(uri, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
  });
});

// Note: Chat-related default mocks are applied per-test via tests/helpers/chatMocks.js

afterEach(async () => {
  // Clear all collections between tests
  const { clearDatabase } = require('./helpers/mongo');
  await clearDatabase();
});

afterAll(async () => {
  const { closeDatabase } = require('./helpers/mongo');
  await closeDatabase();
  if (mongoServer) {
    await mongoServer.stop();
  }
});
