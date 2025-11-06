const express = require("express");
const router = express.Router();
const sendWhatsAppOtp = require("../utils/sendWhatsAppOtp");
const PhoneUser = require("../models/PhoneUser");
const VerifiedUser = require("../models/VerifiedUser");
const OtpRateLimit = require("../models/OtpRateLimit");
const NotificationSettings = require("../models/NotificationSettings");
const { notifyNewUser } = require("../services/notificationService");
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");
const { validateBody } = require("../utils/validationHelpers");
const { generateToken } = require("../utils/jwtHelper");

const otpStore = new Map(); // In-memory temp store (or use Redis)

// Rate limiting configuration
const MAX_OTP_ATTEMPTS = 3; // Maximum OTP requests per 24-hour window
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// Special case: Phone numbers exempt from rate limiting
const RATE_LIMIT_EXEMPT_PHONES = ["9834699858"];

// Check if phone number is exempt from rate limiting
const isRateLimitExempt = (phone) => {
  if (!phone) return false;
  // Normalize phone number by removing all non-digit characters
  const normalizedPhone = phone.replace(/\D/g, "");
  return RATE_LIMIT_EXEMPT_PHONES.some(exemptPhone =>
    normalizedPhone.endsWith(exemptPhone) || normalizedPhone === exemptPhone
  );
};

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ✅ 1) SEND OTP
router.post("/send", async (req, res) => {
  if (!validateBody(req, res)) return;

  const { phone, chatbotId } = req.body;

  if (!phone || !chatbotId)
    return res.status(400).json({ error: "Phone and Chatbot ID are required" });

  try {
    // Skip rate limiting for exempt phone numbers
    const isExempt = isRateLimitExempt(phone);
    if (isExempt) {
      console.log(`Rate limit bypassed for exempt phone: ${phone}`);
    }

    // Check rate limiting (skip for exempt numbers)
    const currentTime = new Date();
    const identifier = { phone };
    let rateLimit = !isExempt ? await OtpRateLimit.findOne(identifier) : null;

    if (rateLimit) {
      // Check if the 24-hour window has expired
      const windowExpired = currentTime - rateLimit.windowStart >= RATE_LIMIT_WINDOW_MS;

      if (windowExpired) {
        // Reset the window and attempts
        rateLimit.windowStart = currentTime;
        rateLimit.attempts = 0;
        rateLimit.lastAttempt = currentTime;
      } else if (rateLimit.attempts >= MAX_OTP_ATTEMPTS) {
        // Rate limit exceeded
        const timeRemaining = RATE_LIMIT_WINDOW_MS - (currentTime - rateLimit.windowStart);
        const hoursRemaining = Math.ceil(timeRemaining / (60 * 60 * 1000));

        return res.status(429).json({
          success: false,
          error: `Rate limit exceeded. You have requested OTP ${MAX_OTP_ATTEMPTS} times in the last 24 hours. Please try again in ${hoursRemaining} hour(s).`,
          attemptsRemaining: 0,
          resetTime: new Date(rateLimit.windowStart.getTime() + RATE_LIMIT_WINDOW_MS)
        });
      }

      // Increment attempts
      rateLimit.attempts += 1;
      rateLimit.lastAttempt = currentTime;
      await rateLimit.save();
    } else {
      // Create new rate limit record
      rateLimit = await OtpRateLimit.create({
        ...identifier,
        attempts: 1,
        windowStart: currentTime,
        lastAttempt: currentTime,
      });
    }

    console.log(`Rate limit check passed. Attempts: ${rateLimit.attempts}/${MAX_OTP_ATTEMPTS}`);

    const otp = generateOtp();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    const key = `${phone}-${chatbotId}`;
    otpStore.set(key, { otp, expiresAt });

    console.log(`📄 OTP stored for key ${key}:`, { otp, expiresAt });

    const sent = await sendWhatsAppOtp(phone, otp);
    if (sent) {
      // For exempt numbers, don't include rate limit info in response
      if (isExempt) {
        return res.json({
          success: true,
          message: "OTP sent via WhatsApp"
        });
      }

      const attemptsRemaining = MAX_OTP_ATTEMPTS - rateLimit.attempts;
      return res.json({
        success: true,
        message: "OTP sent via WhatsApp",
        attemptsRemaining,
        maxAttempts: MAX_OTP_ATTEMPTS
      });
    }

    // Rollback rate limit attempt on send failure (only if not exempt)
    if (rateLimit) {
      rateLimit.attempts -= 1;
      await rateLimit.save();
    }

    return res
      .status(500)
      .json({ success: false, message: "Failed to send WhatsApp OTP" });
  } catch (error) {
    console.error("Error in WhatsApp OTP send:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// ✅ 2) VERIFY OTP + SAVE USER + NOTIFY (NEW)
router.post("/verify", async (req, res) => {
  if (!validateBody(req, res)) return;

  const { phone, otp, chatbotId } = req.body;

  console.log("🔹 WA verify called:", { phone, otp, chatbotId });

  if (!phone || !otp || !chatbotId) {
    console.warn("❌ Missing phone/otp/chatbotId");
    return res
      .status(400)
      .json({
        success: false,
        error: "Phone, OTP, and Chatbot ID are required",
      });
  }

  const key = `${phone}-${chatbotId}`;
  const stored = otpStore.get(key);
  console.log("📄 Stored OTP for key:", key, stored);

  if (!stored) {
    console.warn("❌ OTP not found in store");
    return res
      .status(404)
      .json({ success: false, error: "OTP not found. Please request again." });
  }

  const isExpired = Date.now() > stored.expiresAt;
  const isMatch = stored.otp === otp;
  console.log("✅ OTP check:", { isMatch, isExpired });

  if (!isMatch || isExpired) {
    return res
      .status(400)
      .json({
        success: false,
        error: isExpired ? "OTP has expired" : "Invalid OTP",
      });
  }

  // Save/refresh phone user
  const user = await PhoneUser.findOneAndUpdate(
    { phone, chatbotId },
    { $set: { verified: true, updatedAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Determine first-ever login for this phone+chatbot
  const priorVerifications = await VerifiedUser.countDocuments({
    phone,
    chatbot_id: chatbotId,
  });
  const isFirstEverLogin = priorVerifications === 0;
  console.log("👤 Existing user check:", {
    priorVerifications,
    isFirstEverLogin,
  });

  // Gather request context
  const ip = (req.headers["x-forwarded-for"] || req.ip || "")
    .split(",")[0]
    .trim();
  const ua = req.headers["user-agent"] || "";
  console.log("🌐 Context:", { ip, ua });

  // Load NotificationSettings (by chatbotId only; companyId optional)
  const settingsQuery = { chatbotId: new mongoose.Types.ObjectId(chatbotId) };
  const settings = await NotificationSettings.findOne(settingsQuery);
  console.log("⚙️ Settings.email:", settings?.email);

  const notifyEvery = !!settings?.email?.notifyEveryLogin;
  const recipients = settings?.email?.recipients || [];
  const shouldNotify =
    settings?.email?.enabled &&
    recipients.length > 0 &&
    (notifyEvery || isFirstEverLogin);

  console.log("📣 Notify decision:", {
    enabled: settings?.email?.enabled,
    notifyEvery,
    isFirstEverLogin,
    recipients,
    shouldNotify,
  });

  if (shouldNotify) {
    try {
      console.log("🚀 Sending email notification (WhatsApp OTP)...");
      await notifyNewUser({
        settings,
        user: { phone, provider: "whatsapp-otp", chatbotId },
        context: { ip, ua, chatbotId, time: new Date() },
      });
      console.log("✅ Notification sent");
    } catch (err) {
      console.error("❌ notifyNewUser error:", err);
      // don’t fail login on email error
    }
  } else {
    console.log("ℹ️ Notification skipped");
  }

  // Log verification for future "first-ever" checks
  await VerifiedUser.create({
    phone,
    chatbot_id: chatbotId,
    session_id: uuidv4(),
    verified_at: new Date(),
    provider: "whatsapp-otp",
  });
  console.log("🗂 VerifiedUser log created");

  // Clean up OTP from memory
  otpStore.delete(key);

  // Generate JWT token with 24-hour expiry
  const tokenData = generateToken({
    userId: user._id.toString(),
    phone: phone,
    chatbotId: chatbotId,
  });

  // Return success with JWT token and user info
  return res.json({
    success: true,
    token: tokenData.token,
    userInfo: {
      phone: phone,
      userId: user._id.toString(),
      chatbotId: chatbotId,
    },
    expiresIn: tokenData.expiresIn,
    issuedAt: tokenData.issuedAt,
    expiresAt: tokenData.expiresAt,
  });
});

// ✅ 3) CHECK SESSION (unchanged)
router.get("/check-session", async (req, res) => {
  try {
    const SESSION_VALIDITY_MS = 24 * 60 * 60 * 1000;
    const { phone, chatbotId } = req.query;

    if (!phone || !chatbotId) {
      return res
        .status(400)
        .json({ message: "Phone and Chatbot ID are required" });
    }

    const cutoffTime = new Date(Date.now() - SESSION_VALIDITY_MS);
    const user = await PhoneUser.findOne({
      phone,
      chatbotId,
      verified: true,
      updatedAt: { $gte: cutoffTime },
    });

    res.json({ valid: !!user });
  } catch (err) {
    console.error("checkSession error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

module.exports = router;
