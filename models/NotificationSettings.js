// models/NotificationSettings.js
const mongoose = require("mongoose");

const NotificationSettingsSchema = new mongoose.Schema({
  chatbotId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },

  email: {
    enabled: { type: Boolean, default: true },
    recipients: [{ type: String, trim: true }],
    subjectTemplate: { type: String, default: "New user authenticated" },
    bodyTemplate: {
      type: String,
      default:
        "A new user has signed in.\n\nUser: {{user}}\nProvider: {{provider}}\nIP: {{ip}}\nWhen: {{time}}",
    },
    notifyEveryLogin: { type: Boolean, default: false }, // false = only first time
  },
}, { timestamps: true });

module.exports = mongoose.model("NotificationSettings", NotificationSettingsSchema);
