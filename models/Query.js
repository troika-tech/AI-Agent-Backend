const mongoose = require("mongoose");

const querySchema = new mongoose.Schema({
  chatbotId: { type: mongoose.Schema.Types.ObjectId, required: true },
  email: { type: String, required: true },
  name: { type: String }, // optional
  phone: { type: String }, // ✅ added phone number
  question: { type: String, required: true },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

querySchema.index({ chatbotId: 1, createdAt: -1 });

module.exports = mongoose.model("Query", querySchema);
