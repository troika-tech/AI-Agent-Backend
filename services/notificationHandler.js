const mongoose = require("mongoose");
const NotificationSettings = require("../models/NotificationSettings");
const { notifyNewUser } = require("./notificationService"); // Your service that formats and sends email

const handleLoginNotification = async ({ chatbotId, user, context, isFirstEverLogin }) => {
  try {
    const settings = await NotificationSettings.findOne({ chatbot_id: chatbotId });

    // Exit early if notifications are not enabled in the settings
    if (!settings?.email?.enabled) {
      console.log("ℹ️ Email notifications are disabled for this chatbot.");
      return;
    }

    // Decide if a notification should be sent based on the settings
    const notifyEvery = !!settings.email.notifyEveryLogin;
    const shouldNotify = notifyEvery || isFirstEverLogin;

    console.log("📣 Notification decision:", { notifyEvery, isFirstEverLogin, shouldNotify });

    if (shouldNotify) {
      console.log("🚀 Calling notification service...");
      // Pass the details to your notification service, which handles the email formatting and sending
      await notifyNewUser({
        settings,
        user,
        context: { ...context, time: new Date() },
      });
      console.log("✅ Notification service was called successfully.");
    } else {
      console.log("ℹ️ Notification skipped based on settings (not a new user and notifyEveryLogin is off).");
    }
  } catch (err) {
    // Log any errors that occur during the process
    console.error("❌ Error occurred within the notification handler:", err);
  }
};

module.exports = { handleLoginNotification };
