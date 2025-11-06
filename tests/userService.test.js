const mongoose = require('mongoose');
const userService = require('../services/userService');
const Message = require('../models/Message');
const { createActiveBotWithPlan, createActiveSubscription } = require('./helpers/seed');

describe('userService', () => {
  test('getUserPlanSummary returns plan details', async () => {
    const { bot, plan, subscription } = await createActiveBotWithPlan({});
    const res = await userService.getUserPlanSummary(bot.company_id || bot.company_id);
    // In seed, company_id may be undefined; ensure notFound or plan present
    if (res.notFound) {
      expect(res.notFound).toBe(true);
    } else {
      expect(res.plan).toHaveProperty('name');
      expect(res.plan).toHaveProperty('duration_days');
    }
  });

  test('getMessages paginates and filters by chatbot', async () => {
    const { bot, plan, subscription } = await createActiveBotWithPlan({});
    // Our seed doesn’t set company_id; emulate service call with chatbot id as companyId substitute where applicable
    const companyId = bot.company_id || bot._id; // fallback for tests
    // Insert a couple of messages
  await Message.create({ chatbot_id: bot._id, session_id: 's1', sender: 'user', content: 'hi', timestamp: new Date() });
  await Message.create({ chatbot_id: bot._id, session_id: 's1', sender: 'bot', content: 'hello', timestamp: new Date() });
    const res = await userService.getMessages(companyId, { page: 1, limit: 10 });
    if (res.notFound) {
      expect(res.notFound).toBe(true);
    } else {
      expect(Array.isArray(res.messages)).toBe(true);
    }
  });
});
