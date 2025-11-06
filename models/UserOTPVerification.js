const mongoose = require("mongoose");

const UserOTPVerificationSchema = new mongoose.Schema({
  email: { type: String, required: true, index: true }, // Indexed for fast lookups
  otp: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model(
  "UserOTPVerification",
  UserOTPVerificationSchema
);
