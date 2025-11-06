const mongoose = require("mongoose");

const phoneUserSchema = new mongoose.Schema(
  {
    phone: String,
    otp: String,
    otpExpiresAt: Date,
    verified: Boolean,
    chatbotId: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("PhoneUser", phoneUserSchema);
