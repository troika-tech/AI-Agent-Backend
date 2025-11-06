// services/authEvents.js
const NotificationSettings = require("../models/NotificationSettings");
const { notifyNewUser } = require("./notificationService");

async function onAuthSuccess({ user, chatbotId, companyId, req }) {
  try {
    const ip = (req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim();
    const ua = req.headers["user-agent"] || "";
    const wasFirstLogin = (user.loginCount || 0) === 0;

    // bump counters + context
    user.loginCount = (user.loginCount || 0) + 1;
    user.lastIp = ip;
    user.lastUserAgent = ua;

    const settings = await NotificationSettings.findOne({ chatbotId, companyId });
    const notifyEvery = !!settings?.email?.notifyEveryLogin;
    const shouldNotify = notifyEvery || (wasFirstLogin && !user.firstLoginNotified);

    // Save user + set firstLoginNotified atomically if we will notify now
    await user.updateOne({
      $set: {
        lastIp: ip,
        lastUserAgent: ua,
        ...(shouldNotify ? { firstLoginNotified: true } : {})
      },
      $inc: { loginCount: 1 }
    });

    if (shouldNotify && settings?.email?.enabled && (settings.email.recipients || []).length) {
      await notifyNewUser({
        settings,
        user, // contains email/phone/provider/chatbotId/companyId
        context: { ip, ua, chatbotId, companyId, time: new Date() },
      });
    }
  } catch (err) {
    console.error("onAuthSuccess error:", err);
    // Don’t throw—auth should still succeed even if notification fails
  }
}

module.exports = { onAuthSuccess };
// services/authEvents.js
