const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");

const UserOtpVerification = require("../models/UserOTPVerification");
const VerifiedUser = require("../models/VerifiedUser");
const UserSession = require("../models/UserSession");
const Subscription = require("../models/Subscription");
const { sendOtpEmail } = require("../services/emailService");

// 👇 add these:
const NotificationSettings = require("../models/NotificationSettings");
const { notifyNewUser } = require("../services/notificationService");
// optional: if you need companyId and it's not on Subscription, you can use Chatbot model
// const Chatbot = require("../models/Chatbot");
const { validateBody } = require("../utils/validationHelpers");

const SESSION_VALIDITY_HOURS = 6;
const SESSION_VALIDITY_MS = SESSION_VALIDITY_HOURS * 60 * 60 * 1000;

// ✅ Send OTP (no change)
exports.requestOtp = async (req, res) => {
  if (!validateBody(req, res)) return;

  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  await UserOtpVerification.create({ email, otp });
  await sendOtpEmail(email, otp);

  res.json({ message: "OTP sent to your email" });
};

// ✅ Verify OTP (UPDATED: notification wired in)
exports.verifyOtp = async (req, res) => {
  if (!validateBody(req, res)) return;

  const { email, otp, chatbotId, sessionId } = req.body;

  console.log("🔹 verifyOtp called with:", {
    email,
    otp,
    chatbotId,
    sessionId,
  });

  if (!email || !otp || !chatbotId) {
    console.warn("❌ Missing required fields");
    return res
      .status(400)
      .json({ message: "Email, OTP, and Chatbot ID required" });
  }

  // 🔍 Find the latest OTP for this email
  const record = await UserOtpVerification.findOne({ email }).sort({
    created_at: -1,
  });
  console.log("📄 Latest OTP record:", record);

  if (!record) {
    console.warn("❌ No OTP record found for email:", email);
    return res.status(400).json({ message: "Invalid request" });
  }

  const isValid = record.otp === otp;
  const ageInMin = (Date.now() - record.created_at.getTime()) / 60000;
  console.log("✅ OTP check:", { isValid, ageInMin });

  if (!isValid || ageInMin > 10) {
    console.warn("❌ OTP expired or incorrect");
    return res.status(400).json({ message: "OTP expired or incorrect" });
  }

  // 🔍 Count previous verifications for this user + chatbot
  const priorVerifications = await VerifiedUser.countDocuments({
    email,
    chatbot_id: chatbotId,
  });
  const isFirstEverLogin = priorVerifications === 0;
  console.log("👤 Existing user check:", {
    priorVerifications,
    isFirstEverLogin,
  });

  // 🧠 Gather context info
  const ip = (req.headers["x-forwarded-for"] || req.ip || "")
    .split(",")[0]
    .trim();
  const ua = req.headers["user-agent"] || "";
  console.log("🌐 Request context:", { ip, ua });

  // 🔍 Load Notification Settings
  const settingsQuery = { chatbotId: new mongoose.Types.ObjectId(chatbotId) };
  const settings = await NotificationSettings.findOne(settingsQuery);
  console.log("⚙️ Notification settings loaded:", settings?.email);

  const notifyEvery = !!settings?.email?.notifyEveryLogin;
  const shouldNotify =
    settings?.email?.enabled && (notifyEvery || isFirstEverLogin);
  console.log("📣 Notification decision:", {
    enabled: settings?.email?.enabled,
    notifyEvery,
    isFirstEverLogin,
    shouldNotify,
    recipients: settings?.email?.recipients,
  });

  // 🔔 Send notification if required
  if (shouldNotify) {
    console.log("🚀 Sending notification email...");
    try {
      await notifyNewUser({
        settings,
        user: { email, provider: "email-otp", chatbotId },
        context: { ip, ua, chatbotId, time: new Date() },
      });
      console.log("✅ Notification sent successfully");
    } catch (err) {
      console.error("❌ Error sending notification:", err);
    }
  } else {
    console.log("ℹ️ Notification skipped");
  }

  // 📌 Log verified login
  await VerifiedUser.create({
    email,
    chatbot_id: chatbotId,
    session_id: sessionId || uuidv4(),
    provider: "email-otp", // Added provider field
    verified_at: new Date(),
  });
  console.log("🗂 VerifiedUser record created");

  res.json({ success: true });
};

// ✅ Check session (unchanged)
exports.checkSession = async (req, res) => {
  try {
    const { email, chatbotId } = req.query;

    if (!email || !chatbotId) {
      return res
        .status(400)
        .json({ message: "Email and Chatbot ID are required" });
    }

    const cutoffTime = new Date(Date.now() - SESSION_VALIDITY_MS);

    const recentSession = await UserSession.findOne({
      email,
      chatbot_id: new mongoose.Types.ObjectId(chatbotId),
      last_verified: { $gte: cutoffTime },
    }).sort({ last_verified: -1 });

    res.json({ valid: !!recentSession });
  } catch (err) {
    console.error("checkSession error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
};
