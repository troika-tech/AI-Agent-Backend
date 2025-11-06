const Chatbot = require("../models/Chatbot");
const { validateBody } = require("../utils/validationHelpers");

async function checkTokenLimits(req, res, next) {
  if (!validateBody(req, res)) return;

  const { chatbotId } = req.body;
  const today = new Date().toISOString().split("T")[0];

  // Fetch chatbot record
  const chatbot = await Chatbot.findOne({ _id: chatbotId });

  if (!chatbot) {
    return res.status(404).json({ message: "Chatbot not found" });
  }

  // Daily reset check
  if (chatbot.last_reset !== today) {
    await Chatbot.findOneAndUpdate(
      { _id: chatbotId },
      { used_today: 0, last_reset: today }
    );
    chatbot.used_today = 0;
  }

  // Check limits
  if (chatbot.used_tokens >= chatbot.token_limit) {
    return res.status(403).json({ message: "Total token limit reached." });
  }

//   if (chatbot.used_today >= chatbot.daily_limit) {
//     return res.status(429).json({ message: "Daily token limit reached." });
//   }

  // Attach chatbot record for later use
  req.chatbot = chatbot;
  next();
}

module.exports = checkTokenLimits;
