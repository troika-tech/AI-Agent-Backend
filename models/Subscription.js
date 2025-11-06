const mongoose = require("mongoose");

const SubscriptionSchema = new mongoose.Schema({
  chatbot_id: { type: mongoose.Schema.Types.ObjectId, ref: "Chatbot", required: true },
  plan_id: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true },
  chatbot_name: { type: String },
  company_name: { type: String },
  plan_name: { type: String },
  start_date: { type: Date, default: Date.now },
  end_date: { type: Date, required: true },
  status: { type: String, default: "active" },
  created_at: { type: Date, default: Date.now }
});

// Optimize subscription lookups by chatbot and status
SubscriptionSchema.index({ chatbot_id: 1, status: 1 });

module.exports = mongoose.model("Subscription", SubscriptionSchema);
