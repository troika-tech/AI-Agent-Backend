/**
 * Check phone numbers in Message collection for specific chatbot
 *
 * Usage: node check-messages-phone-data.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const TARGET_CHATBOT_ID = '68ff51efd9538341c9e1e34c';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot';

async function checkMessagePhoneData() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('🎯 Target Chatbot ID:', TARGET_CHATBOT_ID);
    console.log('='.repeat(80));

    // Define Message schema
    const MessageSchema = new mongoose.Schema({
      chatbot_id: mongoose.Schema.Types.ObjectId,
      content: String,
      sender: String,
      timestamp: Date,
      session_id: String,
      email: String,
      phone: String,
      token_count: Number,
      is_guest: Boolean,
    });

    const Message = mongoose.model('Message', MessageSchema);
    const chatbotObjectId = new mongoose.Types.ObjectId(TARGET_CHATBOT_ID);

    // Check messages with phone numbers
    console.log('\n📱 Checking Message collection for phone numbers...');
    console.log('-'.repeat(80));

    const totalMessages = await Message.countDocuments({ chatbot_id: chatbotObjectId });
    console.log(`Total messages for this chatbot: ${totalMessages}`);

    const messagesWithPhone = await Message.countDocuments({
      chatbot_id: chatbotObjectId,
      phone: { $exists: true, $ne: null, $ne: "" }
    });
    console.log(`Messages with phone numbers: ${messagesWithPhone}`);

    // Get unique phone numbers
    const uniquePhones = await Message.distinct('phone', {
      chatbot_id: chatbotObjectId,
      phone: { $exists: true, $ne: null, $ne: "" }
    });

    console.log(`\n📊 Unique phone numbers: ${uniquePhones.length}`);

    if (uniquePhones.length > 0) {
      console.log('\n📋 All unique phone numbers found:');
      uniquePhones.forEach((phone, index) => {
        console.log(`  ${index + 1}. ${phone}`);
      });

      // Get detailed info for each phone number
      console.log('\n📝 Detailed information for each phone number:');
      for (const phone of uniquePhones) {
        const messages = await Message.find({
          chatbot_id: chatbotObjectId,
          phone: phone
        }).sort({ timestamp: 1 }).select('phone timestamp session_id is_guest');

        const firstMessage = messages[0];
        const lastMessage = messages[messages.length - 1];

        console.log(`\n  Phone: ${phone}`);
        console.log(`    Total Messages: ${messages.length}`);
        console.log(`    First Seen: ${firstMessage.timestamp}`);
        console.log(`    Last Seen: ${lastMessage.timestamp}`);
        console.log(`    Session IDs: ${[...new Set(messages.map(m => m.session_id))].join(', ')}`);
        console.log(`    Is Guest: ${firstMessage.is_guest || false}`);
      }

      // Create leads structure as API should return
      console.log('\n\n🔄 Creating Leads Structure (what API should return)...');
      console.log('-'.repeat(80));

      const leads = [];
      for (const phone of uniquePhones) {
        const firstMessage = await Message.findOne({
          chatbot_id: chatbotObjectId,
          phone: phone
        }).sort({ timestamp: 1 });

        leads.push({
          id: String(firstMessage._id),
          phone: phone,
          verified: true, // Assume verified since they're in messages
          verifiedAt: firstMessage.timestamp,
          source: 'message_history',
          sessionId: firstMessage.session_id
        });
      }

      // Sort by verifiedAt descending
      leads.sort((a, b) => new Date(b.verifiedAt) - new Date(a.verifiedAt));

      console.log('\n📦 Simulated API Response:');
      console.log(JSON.stringify({
        success: true,
        status: 200,
        message: 'Success',
        data: {
          leads: leads,
          total: leads.length,
          currentPage: 1,
          totalPages: Math.ceil(leads.length / 10)
        }
      }, null, 2));

      // Date range analysis
      console.log('\n\n📅 Date Range Analysis...');
      console.log('-'.repeat(80));

      const now = new Date();
      const last7days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last30days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const last90days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      let count7 = 0, count30 = 0, count90 = 0;

      for (const phone of uniquePhones) {
        const firstMessage = await Message.findOne({
          chatbot_id: chatbotObjectId,
          phone: phone
        }).sort({ timestamp: 1 });

        if (firstMessage.timestamp >= last7days) count7++;
        if (firstMessage.timestamp >= last30days) count30++;
        if (firstMessage.timestamp >= last90days) count90++;
      }

      console.log('\nPhone numbers by first appearance:');
      console.log(`  Last 7 days:  ${count7}`);
      console.log(`  Last 30 days: ${count30}`);
      console.log(`  Last 90 days: ${count90}`);
      console.log(`  All time:     ${uniquePhones.length}`);
    }

    // Final Summary
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 FINAL SUMMARY FOR CHATBOT', TARGET_CHATBOT_ID);
    console.log('='.repeat(80));

    if (uniquePhones.length === 0) {
      console.log('❌ NO PHONE NUMBERS FOUND IN MESSAGES');
    } else {
      console.log(`✅ FOUND ${uniquePhones.length} UNIQUE PHONE NUMBERS IN MESSAGES`);
      console.log('\n💡 These phone numbers are in the Message collection,');
      console.log('   NOT in PhoneUser or VerifiedUser collections.');
      console.log('\n🔧 THE BACKEND SERVICE NEEDS TO BE UPDATED TO:');
      console.log('   1. Query the Message collection for phone numbers');
      console.log('   2. Extract unique phone numbers from messages');
      console.log('   3. Return them as leads');
      console.log('\n📝 Current implementation looks for:');
      console.log('   - PhoneUser.verified = true');
      console.log('   - VerifiedUser.phone (exists)');
      console.log('\n✨ Should also include:');
      console.log('   - Message.phone (unique values)');
    }

    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

checkMessagePhoneData();
