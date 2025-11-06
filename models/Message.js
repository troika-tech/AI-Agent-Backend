const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  chatbot_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Chatbot",
    required: true,
    index: true,
  },
  session_id: {
    type: String,
    required: true,
    index: true,
  },
  email: {
    type: String,
    default: null,
    trim: true,
  },
  phone: {
    type: String,
    default: null,
    trim: true,
  },
  name: {
    type: String,
    default: null,
    trim: true,
  },
  sender: {
    type: String,
    enum: ["user", "bot"],
    required: true,
    index: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  token_count: {
    type: Number,
    default: 0,
  },
  // 🎯 Add is_guest field to flag guest messages
  is_guest: {
    type: Boolean,
    default: false,
    index: true,
  },
});

// ✅ Remove the pre-validate email/phone requirement entirely.
// Validation about when to require auth is handled in the controller
// using free_messages + auth_method logic.

// 📌 Compound indexes to optimize common queries
// For fetching message history within a chatbot + session sorted by recent
messageSchema.index({ chatbot_id: 1, session_id: 1, timestamp: -1 });

// For filtering by sender (user/bot) per chatbot and recency
messageSchema.index({ chatbot_id: 1, sender: 1, timestamp: -1 });

// For guest message counting/filters per chatbot
messageSchema.index({ chatbot_id: 1, is_guest: 1, sender: 1 });

// For session-based queries ordered by recency
messageSchema.index({ session_id: 1, timestamp: -1 });

module.exports = mongoose.model("Message", messageSchema);
