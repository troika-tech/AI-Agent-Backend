const mongoose = require('mongoose');
const userService = require('../services/userService');
const { createActiveBotWithPlan } = require('./helpers/seed');
const Company = require('../models/Company');
const VerifiedUser = require('../models/VerifiedUser');
const Message = require('../models/Message');

describe('userService CSV exports', () => {
  test('exportVerifiedEmailsPhonesCSV returns CSV for verified contacts', async () => {
    // Create a company and active bot with subscription, then link company to bot
    const company = await Company.create({ name: 'Co', email: 'co@example.com', password_hash: 'x', url: 'https://co.test' });
    const { bot } = await createActiveBotWithPlan({});
    bot.company_id = company._id;
    await bot.save();

    // Insert verified users (within subscription window by default)
    await VerifiedUser.create({
      email: 'User@Example.com',
      chatbot_id: bot._id,
      session_id: 's1',
      provider: 'email-otp',
    });
    await VerifiedUser.create({
      phone: '+1234567890',
      chatbot_id: bot._id,
      session_id: 's2',
      provider: 'whatsapp-otp',
    });

    const res = await userService.exportVerifiedEmailsPhonesCSV(company._id);
    expect(res.notFound).not.toBe(true);
  // Header with possible quotes
  expect(res.csv).toMatch(/"?type"?,"?contact"?/i);
  // Lowercased email and phone present (allow quotes)
  expect(res.csv).toMatch(/"?email"?,"?user@example.com"?/i);
  expect(res.csv).toMatch(/"?phone"?,"?\+1234567890"?/);
  });

  test('exportVerifiedEmailsPhonesCSV returns notFound when no contacts', async () => {
    const company = await Company.create({ name: 'EmptyCo', email: 'empty@example.com', password_hash: 'x', url: 'https://empty.test' });
    const { bot } = await createActiveBotWithPlan({});
    bot.company_id = company._id;
    await bot.save();

    const res = await userService.exportVerifiedEmailsPhonesCSV(company._id);
    expect(res.notFound).toBe(true);
  });

  test('exportAllEmailsPhonesFromMessagesCSV dedupes and normalizes', async () => {
    const company = await Company.create({ name: 'MsgCo', email: 'msg@example.com', password_hash: 'x', url: 'https://msg.test' });
    const { bot } = await createActiveBotWithPlan({});
    bot.company_id = company._id;
    await bot.save();

    // Mixed-case emails and duplicate phones
    await Message.create({ chatbot_id: bot._id, session_id: 'm1', sender: 'user', content: 'hi', timestamp: new Date(), email: 'Alice@EXAMPLE.com' });
    await Message.create({ chatbot_id: bot._id, session_id: 'm1', sender: 'bot', content: 'ok', timestamp: new Date(), email: 'alice@example.com' });
    await Message.create({ chatbot_id: bot._id, session_id: 'm2', sender: 'user', content: 'yo', timestamp: new Date(), phone: '  +1987654321  ' });
    await Message.create({ chatbot_id: bot._id, session_id: 'm3', sender: 'user', content: 'hey', timestamp: new Date(), phone: '+1987654321' });

    const res = await userService.exportAllEmailsPhonesFromMessagesCSV(company._id);
    expect(res.notFound).not.toBe(true);
  // Header with possible quotes
  expect(res.csv).toMatch(/"?type"?,"?contact"?/i);
  // Should only include deduped, normalized email once (allow quotes)
  const emailOccurrences = (res.csv.match(/"?email"?,"?alice@example.com"?/g) || []).length;
    expect(emailOccurrences).toBe(1);
  // Phone deduped (allow quotes)
  const phoneOccurrences = (res.csv.match(/"?phone"?,"?\+1987654321"?/g) || []).length;
    expect(phoneOccurrences).toBe(1);
  });

  test('exportAllEmailsPhonesFromMessagesCSV returns notFound when empty', async () => {
    const company = await Company.create({ name: 'NoneCo', email: 'none@example.com', password_hash: 'x', url: 'https://none.test' });
    const { bot } = await createActiveBotWithPlan({});
    bot.company_id = company._id;
    await bot.save();

    const res = await userService.exportAllEmailsPhonesFromMessagesCSV(company._id);
    expect(res.notFound).toBe(true);
  });
});
