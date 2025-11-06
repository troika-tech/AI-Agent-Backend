const mongoose = require("mongoose");

const userSessionSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },
    chatbot_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chatbot",
      required: true,
    },
    last_verified: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// ⚡️ Compound index for fast matching of email + chatbot
// userSessionSchema.index({ email: 1, chatbot_id: 1 }, { unique: true });

module.exports = mongoose.model("UserSession", userSessionSchema);
