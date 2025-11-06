const mongoose = require("mongoose");

const newUserOtpVerificationSchema = new mongoose.Schema(
  {
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    otp: { type: String, required: true },
    // TTL: MongoDB will auto-delete after ~10 minutes
    created_at: { type: Date, default: Date.now, expires: "10m" },
  },
  { timestamps: false }
);

/**
 * Important: do NOT use a compound sparse unique index on {email, phone}.
 * Use two partial unique indexes so either identifier is enforced independently.
 */
newUserOtpVerificationSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $exists: true, $ne: null } } }
);
newUserOtpVerificationSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $exists: true, $ne: null } } }
);

module.exports = mongoose.model("NewUserOtpVerification", newUserOtpVerificationSchema);
