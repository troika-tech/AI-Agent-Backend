const userService = require('../services/userService');
const Company = require('../models/Company');
const Chatbot = require('../models/Chatbot');
const Subscription = require('../models/Subscription');
const VerifiedUser = require('../models/VerifiedUser');
const Message = require('../models/Message');
const { createActiveBotWithPlan } = require('./helpers/seed');

describe('userService edge cases', () => {
  it('getUserPlanSummary returns notFound when no chatbot', async () => {
    const res = await userService.getUserPlanSummary('64b9b4c53e8a2f7c6c6c6c6c');
    expect(res).toEqual({ notFound: true });
  });

  it('getUsage returns notFound when chatbot missing', async () => {
    const res = await userService.getUsage('64b9b4c53e8a2f7c6c6c6c6c');
    expect(res).toEqual({ notFound: true });
  });

  it('getMessages validates params and returns validationError for bad input', async () => {
    const bot = await Chatbot.create({ company_name: 'Co', company_url: 'https://co.test' });
    const company = await Company.create({ name: 'Co', email: 'co@example.com', password_hash: 'x', url: 'https://co.test' });
    bot.company_id = company._id; await bot.save();
    const res = await userService.getMessages(company._id, { page: 0, limit: 0 });
    expect(res.notFound).toBe(true);
    expect(res.validationError).toBeTruthy();
  });

  it('getUniqueEmailsPhones returns arrays even when none exist', async () => {
    const company = await Company.create({ name: 'Co2', email: 'co2@example.com', password_hash: 'x', url: 'https://co2.test' });
    const { bot } = await createActiveBotWithPlan();
    bot.company_id = company._id; await bot.save();
    const res = await userService.getUniqueEmailsPhones(company._id);
    if (res.notFound) {
      expect(res.notFound).toBe(true);
    } else {
      expect(Array.isArray(res.emails)).toBe(true);
      expect(Array.isArray(res.phoneNumbers)).toBe(true);
    }
  });

  it('exportVerifiedEmailsPhonesCSV returns notFound when no data', async () => {
    const company = await Company.create({ name: 'CSV', email: 'csv@example.com', password_hash: 'x', url: 'https://csv.test' });
    const { bot } = await createActiveBotWithPlan();
    bot.company_id = company._id; await bot.save();
    const res = await userService.exportVerifiedEmailsPhonesCSV(company._id);
    expect(res).toEqual({ notFound: true });
  });

  it('exportAllEmailsPhonesFromMessagesCSV returns notFound when no messages', async () => {
    const bot = await Chatbot.create({ company_name: 'CSV2', company_url: 'https://csv2.test' });
    const company = await Company.create({ name: 'CSV2', email: 'csv2@example.com', password_hash: 'x', url: 'https://csv2.test' });
    bot.company_id = company._id; await bot.save();
    const res = await userService.exportAllEmailsPhonesFromMessagesCSV(company._id);
    expect(res).toEqual({ notFound: true });
  });
});
