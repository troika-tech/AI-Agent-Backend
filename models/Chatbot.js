const mongoose = require("mongoose");

const ChatbotSchema = new mongoose.Schema({
  company_id: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
  name: { type: String },
  company_name: { type: String, required: true },
  company_url: { type: String, required: true },
  phoneNumberId: { type: String, index: true }, // WhatsApp Business Phone Number ID
  token_limit: { type: Number, default: 10000000 },
  used_tokens: { type: Number, default: 0 },
  monthlyUsed: { type: Number, default: 0 },
  monthlyLimit: { type: Number, default: 1000000 },
  status: { type: String, default: 'active' },
  used_today: { type: Number, default: 0 },
  last_reset: { type: String, default: '' },
  persona_text: {
    type: String,
    required: true,
    default: `You are Supa Agent — a friendly, female, professional, and knowledgeable company representative.

Your role is to:
- Explain what the company offers, how it works, and where it can be used.
- Make the concept easy to understand, and encourage users to explore the product or service.

INSTRUCTIONS:
#Communication Style:
[Be conversational]: Talk like a colleague explaining something to a friend.
[Proactive & engaging]: Guide the user forward naturally, often ending with a short question.
[Stick to role]: Never say you're an AI. For details not in your knowledge base, direct users to the company’s official support channels.

📝 RESPONSE RULES:
1. Never repeat yourself.
2. Do not guess anything outside the context provided below.
3. Do not provide any links.

📚 CONTEXT:
Use the given context as the only source of truth. If no context is available, rely on recent history and conversation flow.
`,
  },

  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.models.Chatbot || mongoose.model("Chatbot", ChatbotSchema);
