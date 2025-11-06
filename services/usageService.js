// services/usageService.js
const Chatbot = require("../models/Chatbot");

async function checkAndUpdateUsage(chatbotId) {
  const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd

  const bot = await Chatbot.findOne({ _id: chatbotId });

  if (!bot) throw new Error("Chatbot not found");

  // Block if manually disabled
  if (bot.status === "disabled") {
    throw new Error("Chatbot is disabled");
  }

  // Check monthly limit only
  if (bot.monthlyUsed >= bot.monthlyLimit) {
    throw new Error("Monthly limit exceeded");
  }

  // Always increment monthly usage
  await Chatbot.findOneAndUpdate(
    { _id: chatbotId },
    { $inc: { monthlyUsed: 1 } }
  );
}

module.exports = { checkAndUpdateUsage };
