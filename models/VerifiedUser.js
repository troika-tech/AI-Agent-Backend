// models/VerifiedUser.js
const mongoose = require("mongoose");

const VerifiedUserSchema = new mongoose.Schema({
  email: { type: String, required: false, index: true, sparse: true },
  phone: { type: String, required: false, index: true, sparse: true },
  chatbot_id: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  session_id: { type: String, required: true },
  verified_at: { type: Date, default: Date.now },
  provider: { type: String, enum: ["email-otp", "whatsapp-otp", "google", "facebook", "instagram"], required: true },
});

// Custom validator: at least one of email or phone
VerifiedUserSchema.pre("validate", function (next) {
  if (!this.email && !this.phone) {
    return next(new Error("Either email or phone is required."));
  }
  next();
});

// Helpful compound indexes
VerifiedUserSchema.index({ email: 1, chatbot_id: 1 });
VerifiedUserSchema.index({ phone: 1, chatbot_id: 1 });

module.exports = mongoose.model("VerifiedUser", VerifiedUserSchema);
