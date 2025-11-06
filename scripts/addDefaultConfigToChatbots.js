// scripts/addDefaultConfigToChatbots.js

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Chatbot = require("../models/Chatbot");
const ClientConfig = require("../models/ClientConfig");
const defaultSuggestions = require("../constants/defaultSuggestions");

dotenv.config();

mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    console.log("✅ MongoDB connected");

    const chatbots = await Chatbot.find({});
    let addedNewConfig = 0;
    let updatedSuggestions = 0;

    for (const bot of chatbots) {
      const config = await ClientConfig.findOne({ chatbot_id: bot._id });

      if (!config) {
        // No config → create with default UI suggestions and empty intents
        await ClientConfig.create({
          chatbot_id: bot._id,
          ui_suggestions: defaultSuggestions,
          link_intents: [],
        });
        console.log(`✅ Created config for chatbot ${bot._id}`);
        addedNewConfig++;
      } else if (!config.ui_suggestions || config.ui_suggestions.length === 0) {
        // Config exists but missing ui_suggestions → update
        config.ui_suggestions = defaultSuggestions;
        await config.save();
        console.log(`🛠️ Added default suggestions to existing config for chatbot ${bot._id}`);
        updatedSuggestions++;
      } else {
        // Config already has ui_suggestions → skip
        console.log(`⏭️ Skipped chatbot ${bot._id} (already has suggestions)`);
      }
    }

    console.log(`\n🎯 Summary:`);
    console.log(`➕ ${addedNewConfig} new configs created`);
    console.log(`🛠️ ${updatedSuggestions} existing configs updated`);
    console.log(`✅ Done`);
    mongoose.disconnect();
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error", err);
    process.exit(1);
  });
