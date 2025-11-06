const Plan = require('../../models/Plan');
const Chatbot = require('../../models/Chatbot');
const Subscription = require('../../models/Subscription');
const ClientConfig = require('../../models/ClientConfig');
const Product = require('../../models/AzaModel');

async function createActiveBotWithPlan({
  company_name = 'Test Co',
  company_url = 'https://example.com',
  plan = { name: 'Basic', duration_days: 30, max_users: 10 },
  subscription = { status: 'active', endInMs: 24 * 60 * 60 * 1000 },
} = {}) {
  const planDoc = await Plan.create(plan);
  const botDoc = await Chatbot.create({ company_name, company_url });
  const subDoc = await Subscription.create({
    chatbot_id: botDoc._id,
    plan_id: planDoc._id,
    status: subscription.status,
    end_date: new Date(Date.now() + (subscription.endInMs || 0)),
  });

  return {
    plan: planDoc,
    bot: botDoc,
    subscription: subDoc,
    chatbotId: botDoc._id.toString(),
  };
}

async function createPlan(data = { name: 'Basic', duration_days: 30, max_users: 10 }) {
  return Plan.create(data);
}

async function createChatbot(data = { company_name: 'Test Co', company_url: 'https://example.com' }) {
  return Chatbot.create(data);
}

async function createActiveSubscription({ chatbot_id, plan_id, endInMs = 24 * 60 * 60 * 1000, status = 'active' }) {
  return Subscription.create({ chatbot_id, plan_id, status, end_date: new Date(Date.now() + endInMs) });
}

async function createClientConfig({ chatbot_id, auth_method = 'email', free_messages = 2, link_intents = [], ui_suggestions = [], require_auth_text = 'Sign in to continue.', product_enabled = false } = {}) {
  return ClientConfig.create({ chatbot_id, auth_method, free_messages, link_intents, ui_suggestions, require_auth_text, product_enabled });
}

async function createProducts(items = []) {
  if (!Array.isArray(items) || items.length === 0) return [];
  return Product.insertMany(items);
}

module.exports = { createActiveBotWithPlan, createPlan, createChatbot, createActiveSubscription, createClientConfig, createProducts };
