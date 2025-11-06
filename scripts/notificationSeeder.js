// notificationSeeder.js
require("dotenv").config({ path: ".env" }); // adjust path if needed
const mongoose = require("mongoose");

const Chatbot = require("../models/Chatbot");
const Company = require("../models/Company");
const NotificationSettings = require("../models/NotificationSettings");

(async () => {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MONGO_URI (or MONGODB_URI) is missing. Add it to .env");
    }

    await mongoose.connect(uri, {
      // use unified defaults (Mongoose v6+ doesn’t need extra options)
    });
    console.log("✅ Connected to MongoDB");

    const chatbots = await Chatbot.find();
    let created = 0, skipped = 0;

    for (const bot of chatbots) {
      const exists = await NotificationSettings.findOne({
        chatbotId: bot._id,
        companyId: bot.company_id,
      });

      if (exists) {
        skipped++;
        continue;
      }

      const company = await Company.findById(bot.company_id);

      await NotificationSettings.create({
        chatbotId: bot._id,
        companyId: bot.company_id,
        email: {
          enabled: true,
          recipients: company?.email ? [company.email] : [],
          subjectTemplate: "New user authenticated",
          bodyTemplate:
            "A new user has signed in.\n\nUser: {{user}}\nProvider: {{provider}}\nIP: {{ip}}\nWhen: {{time}}",
          notifyEveryLogin: false,
        },
      });

      console.log(`➕ Seeded settings for chatbot: ${bot.name}`);
      created++;
    }

    console.log(`\nDone. Created: ${created}, Skipped (already had settings): ${skipped}`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Seeder error:", err.message);
    process.exit(1);
  }
})();
