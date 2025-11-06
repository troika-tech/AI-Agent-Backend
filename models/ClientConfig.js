const mongoose = require("mongoose");

const clientConfigSchema = new mongoose.Schema(
  {
    chatbot_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chatbot",
      required: true,
      unique: true,
      index: true,
    },

    // 🔐 Auth & gating
    auth_method: {
      type: String,
      enum: ["email", "whatsapp"],
      default: "email", // your clients default to email OTP
    },
    free_messages: {  
      type: Number,
      default: 1, // first message free
      min: 0,
      max: 5,     // keep sane upper bound (optional)
    },
    require_auth_text: {
      type: String,
      default: "Sign in to continue.",
      trim: true,
    },

    // 🔗 Intent-based links
    link_intents: [
      {
        intent: { type: String, required: true, trim: true },
        keywords: [{ type: String, trim: true }],
        link: { type: String, required: true, trim: true },
      },
    ],

    // 💬 UI suggestions
    ui_suggestions: [
      {
        label: { type: String, required: true, trim: true },
        icon: { type: String, required: true, trim: true },  // e.g., "FaBuilding"
        bg: { type: String, default: "#10b981", trim: true }, // hex/gradient token
      },
    ],

    // 🖼️ Chatbot logo
    chatbot_logo: {
      type: String,
      trim: true,
      default: "https://raw.githubusercontent.com/troika-tech/Asset/refs/heads/main/Supa%20Agent%20new.png", // default Supa Agent logo
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ClientConfig", clientConfigSchema);
