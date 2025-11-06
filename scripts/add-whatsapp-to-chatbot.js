// Quick script to add WhatsApp phoneNumberId to an existing chatbot
require('dotenv').config();
const mongoose = require('mongoose');
const Chatbot = require('../models/Chatbot');

async function addWhatsAppToFirstChatbot() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find first chatbot
    const chatbot = await Chatbot.findOne();
    
    if (!chatbot) {
      console.log('❌ No chatbots found in database');
      console.log('You need to create a chatbot first through the UI or API');
      process.exit(1);
    }

    console.log(`\n📱 Found chatbot: ${chatbot.name || chatbot.company_name}`);
    console.log(`   ID: ${chatbot._id}`);

    // Add WhatsApp phoneNumberId
    chatbot.phoneNumberId = '1234567890';
    await chatbot.save();

    console.log(`✅ Added phoneNumberId: 1234567890`);
    console.log(`\n🎯 You can now test with:`);
    console.log(`   Phone Number ID: 1234567890`);
    console.log(`   Chatbot ID: ${chatbot._id}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addWhatsAppToFirstChatbot();
