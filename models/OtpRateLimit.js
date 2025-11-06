const mongoose = require("mongoose");

/**
 * Model to track OTP request attempts per phone number or email
 * Enforces a limit of 3 attempts per 24-hour window
 */
const otpRateLimitSchema = new mongoose.Schema({
    // Identifier (either email or phone, both indexed)
    email: {
        type: String,
        default: null,
        lowercase: true,
        trim: true,
        sparse: true, // allows multiple null values
    },
    phone: {
        type: String,
        default: null,
        trim: true,
        sparse: true, // allows multiple null values
    },

    // Attempt tracking
    attempts: {
        type: Number,
        default: 0,
        required: true,
    },

    // Window start time (resets after 24 hours)
    windowStart: {
        type: Date,
        required: true,
        default: Date.now,
    },

    // Last attempt timestamp
    lastAttempt: {
        type: Date,
        required: true,
        default: Date.now,
    },
});

// Compound indexes for quick lookups
otpRateLimitSchema.index({ email: 1 }, { sparse: true });
otpRateLimitSchema.index({ phone: 1 }, { sparse: true });

// TTL index to auto-delete records after 24 hours from windowStart
otpRateLimitSchema.index({ windowStart: 1 }, { expireAfterSeconds: 86400 }); // 24 hours = 86400 seconds

// Validation: ensure at least one identifier is provided
otpRateLimitSchema.pre("validate", function (next) {
    if (!this.email && !this.phone) {
        return next(new Error("Either email or phone must be provided"));
    }
    next();
});

module.exports = mongoose.model("OtpRateLimit", otpRateLimitSchema);
