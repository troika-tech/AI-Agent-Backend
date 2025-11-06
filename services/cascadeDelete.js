const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Models
const Chatbot = require('../models/Chatbot');
const Company = require('../models/Company');
const Message = require('../models/Message');
const VerifiedUser = require('../models/VerifiedUser');
const Subscription = require('../models/Subscription');
const NotificationSettings = require('../models/NotificationSettings');
const ChatbotCustomization = require('../models/ChatbotCustomization');
const ClientConfig = require('../models/ClientConfig');
const EmbeddingChunk = require('../models/Embedding');
const UserSession = require('../models/UserSession');
const NewUserSession = require('../models/newUserSession');
const Query = require('../models/Query');
const PhoneUser = require('../models/PhoneUser');
const CompanyVerifiedUser = require('../models/CompanyVerifiedUser');

const ApiError = require('../utils/ApiError');

/**
 * Delete a chatbot and ALL related data across collections.
 * Returns a summary of deleted counts.
 */
async function deleteChatbotCascade(chatbotId) {
  // Accept both string and ObjectId
  const id = typeof chatbotId === 'string' ? new mongoose.Types.ObjectId(chatbotId) : chatbotId;

  const chatbot = await Chatbot.findById(id);
  if (!chatbot) {
    throw ApiError.notFound('Chatbot not found');
  }

  const idStr = String(id);

  // Perform deletions in parallel
  const [
    msgRes,
    verUserRes,
    subRes,
    notifRes,
    customRes,
    clientCfgRes,
    embRes,
    userSessRes,
    newUserSessRes,
    queryRes,
    phoneUserRes,
  ] = await Promise.all([
    Message.deleteMany({ chatbot_id: id }),
    VerifiedUser.deleteMany({ chatbot_id: id }),
    Subscription.deleteMany({ chatbot_id: id }),
    NotificationSettings.deleteMany({ chatbotId: id }),
    ChatbotCustomization.deleteOne({ chatbotId: id }),
    ClientConfig.deleteOne({ chatbot_id: id }),
    EmbeddingChunk.deleteMany({ chatbot_id: idStr }), // stored as String
    UserSession.deleteMany({ chatbot_id: id }),
    NewUserSession.deleteMany({ chatbot_id: id }),
    Query.deleteMany({ chatbotId: id }),
    PhoneUser.deleteMany({ chatbotId: idStr }), // stored as String
  ]);

  const chatbotRes = await Chatbot.findByIdAndDelete(id);

  const summary = {
    chatbotDeleted: Boolean(chatbotRes),
    messages: msgRes.deletedCount || 0,
    verifiedUsers: verUserRes.deletedCount || 0,
    subscriptions: subRes.deletedCount || 0,
    notificationSettings: notifRes.deletedCount || 0,
    customizations: customRes.deletedCount || 0,
    clientConfigs: clientCfgRes.deletedCount || 0,
    embeddings: embRes.deletedCount || 0,
    userSessions: userSessRes.deletedCount || 0,
    newUserSessions: newUserSessRes.deletedCount || 0,
    queries: queryRes.deletedCount || 0,
    phoneUsers: phoneUserRes.deletedCount || 0,
  };

  logger.info(`[cascade] Deleted chatbot ${idStr}`, summary);
  return summary;
}

/**
 * Delete a company, its chatbots, and ALL related data.
 * Returns a summary including per-chatbot results.
 */
async function deleteCompanyCascade(companyId) {
  const id = typeof companyId === 'string' ? new mongoose.Types.ObjectId(companyId) : companyId;

  const company = await Company.findById(id);
  if (!company) {
    throw ApiError.notFound('Company not found');
  }

  const bots = await Chatbot.find({ company_id: id }).select('_id');
  const botIds = bots.map(b => String(b._id));

  const chatbotSummaries = [];
  for (const bot of bots) {
    const summary = await deleteChatbotCascade(bot._id);
    chatbotSummaries.push({ chatbotId: String(bot._id), summary });
  }

  // Company-level cleanups
  const [companyVerifiedUsersRes, notifSettingsCompanyRes] = await Promise.all([
    CompanyVerifiedUser.deleteMany({ company_id: id }),
    NotificationSettings.deleteMany({ companyId: id }),
  ]);

  const companyRes = await Company.findByIdAndDelete(id);

  const summary = {
    companyDeleted: Boolean(companyRes),
    chatbotsProcessed: botIds.length,
    chatbots: chatbotSummaries,
    companyVerifiedUsers: companyVerifiedUsersRes.deletedCount || 0,
    companyNotificationSettings: notifSettingsCompanyRes.deletedCount || 0,
  };

  logger.info(`[cascade] Deleted company ${String(id)} with ${botIds.length} chatbot(s)`, summary);
  return summary;
}

module.exports = { deleteChatbotCascade, deleteCompanyCascade };
