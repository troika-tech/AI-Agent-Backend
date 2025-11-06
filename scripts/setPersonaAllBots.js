// setPersonaAllBots.js
require("dotenv").config();
const mongoose = require("mongoose");

// ----- Config -----
const PERSONA_TEXT = `You are Supa Agent — a friendly, professional, and knowledgeable **Troika employee**.

Your role is to:
- Explain what Troika Tech offers, how it works, and where it can be used.
- Make the concept easy to understand, and encourage users to explore the technology.

INSTRUCTIONS:
#Communication Style:
[Be concise]: Keep responses 15-25 words max.
[Be authentic]: Use “we” and “our” when referencing Troika.
[Be conversational]: Talk like a colleague explaining something to a friend.
[Proactive & engaging]: Guide the user forward naturally, often ending with a question.
[Stick to role]: Never say you're an AI. Direct users to info@troikatech.net or https://troikatech.in for details not in your knowledge base.

📝 RESPONSE RULES:
1. Strictly keep answers 15-25 words.
2. Never repeat yourself.
3. Do not guess anything outside the context provided below.
4. Do not provide any links.`;

// ----- Parse CLI args -----
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [k, v] = arg.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);
const MODE = (args.mode || "overwrite").toLowerCase(); // "overwrite" | "missing"

// ----- Minimal Chatbot model -----
// (Matches your collection; adjust collection name if needed)
const ChatbotSchema = new mongoose.Schema(
  {
    company_id: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
    name: String,
    company_name: { type: String, required: true },
    company_url: { type: String, required: true },
    token_limit: { type: Number, default: 10000000 },
    used_tokens: { type: Number, default: 0 },
    persona_text: { type: String },
    created_at: { type: Date, default: Date.now },
  },
  { collection: "chatbots" } // ensure correct collection name
);

const Chatbot = mongoose.model("Chatbot", ChatbotSchema);

// ----- Main -----
(async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error("❌ MONGO_URI not set in .env");
      process.exit(1);
    }
    await mongoose.connect(uri, {});

    let filter = {};
    if (MODE === "missing") {
      filter = {
        $or: [
          { persona_text: { $exists: false } },
          { persona_text: null },
          { persona_text: "" },
          { persona_text: { $type: "missing" } },
        ],
      };
    }

    console.log(`🔧 Updating chatbots (mode: ${MODE})...`);
    const result = await Chatbot.updateMany(filter, {
      $set: { persona_text: PERSONA_TEXT },
    });

    // Mongoose returns { acknowledged, matchedCount, modifiedCount, upsertedCount }
    console.log(
      `✅ Done. matched: ${result.matchedCount}, modified: ${result.modifiedCount}`
    );
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
})();
