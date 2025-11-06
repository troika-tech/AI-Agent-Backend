/**
 * Check phone leads for specific chatbot ID
 *
 * Usage: node check-specific-chatbot-leads.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const TARGET_CHATBOT_ID = '68ff51efd9538341c9e1e34c';

// MongoDB connection string from your .env file
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot';

async function checkChatbotLeads() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('🎯 Target Chatbot ID:', TARGET_CHATBOT_ID);
    console.log('='.repeat(80));

    // Define schemas
    const PhoneUserSchema = new mongoose.Schema({
      phone: String,
      otp: String,
      otpExpiresAt: Date,
      verified: Boolean,
      chatbotId: String
    }, { timestamps: true });

    const VerifiedUserSchema = new mongoose.Schema({
      email: String,
      phone: String,
      chatbot_id: mongoose.Schema.Types.ObjectId,
      session_id: String,
      verified_at: Date,
      provider: String,
    });

    const PhoneUser = mongoose.model('PhoneUser', PhoneUserSchema);
    const VerifiedUser = mongoose.model('VerifiedUser', VerifiedUserSchema);

    // Check PhoneUser collection for this chatbot
    console.log('\n📱 Checking PhoneUser collection...');
    console.log('-'.repeat(80));

    const phoneUserQuery = {
      chatbotId: TARGET_CHATBOT_ID,
      phone: { $exists: true, $ne: null, $ne: "" }
    };

    const allPhoneUsers = await PhoneUser.countDocuments(phoneUserQuery);
    console.log(`Total PhoneUser records for this chatbot: ${allPhoneUsers}`);

    const verifiedPhoneUsers = await PhoneUser.countDocuments({
      ...phoneUserQuery,
      verified: true
    });
    console.log(`Verified PhoneUser records: ${verifiedPhoneUsers}`);

    const unverifiedPhoneUsers = await PhoneUser.countDocuments({
      ...phoneUserQuery,
      verified: false
    });
    console.log(`Unverified PhoneUser records: ${unverifiedPhoneUsers}`);

    if (allPhoneUsers > 0) {
      console.log('\n📋 All PhoneUser records for this chatbot:');
      const allRecords = await PhoneUser.find(phoneUserQuery)
        .sort({ createdAt: -1 })
        .select('phone verified createdAt updatedAt');

      allRecords.forEach((record, index) => {
        console.log(`\n  ${index + 1}. Phone: ${record.phone}`);
        console.log(`     Verified: ${record.verified ? '✅ Yes' : '❌ No'}`);
        console.log(`     Created: ${record.createdAt}`);
        console.log(`     Updated: ${record.updatedAt}`);
      });
    }

    // Check VerifiedUser collection for this chatbot
    console.log('\n\n👤 Checking VerifiedUser collection...');
    console.log('-'.repeat(80));

    const chatbotObjectId = new mongoose.Types.ObjectId(TARGET_CHATBOT_ID);
    const verifiedUserQuery = {
      chatbot_id: chatbotObjectId,
      phone: { $exists: true, $ne: null, $ne: "" }
    };

    const verifiedUserCount = await VerifiedUser.countDocuments(verifiedUserQuery);
    console.log(`VerifiedUser records with phone for this chatbot: ${verifiedUserCount}`);

    if (verifiedUserCount > 0) {
      console.log('\n📋 All VerifiedUser records with phone for this chatbot:');
      const verifiedRecords = await VerifiedUser.find(verifiedUserQuery)
        .sort({ verified_at: -1 })
        .select('phone provider verified_at session_id');

      verifiedRecords.forEach((record, index) => {
        console.log(`\n  ${index + 1}. Phone: ${record.phone}`);
        console.log(`     Provider: ${record.provider || 'N/A'}`);
        console.log(`     Verified At: ${record.verified_at}`);
        console.log(`     Session ID: ${record.session_id || 'N/A'}`);
      });
    }

    // Check date ranges
    if (verifiedPhoneUsers > 0 || verifiedUserCount > 0) {
      console.log('\n\n📅 Date Range Analysis...');
      console.log('-'.repeat(80));

      const now = new Date();
      const last7days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last30days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const last90days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      // PhoneUser date ranges
      if (verifiedPhoneUsers > 0) {
        const last7 = await PhoneUser.countDocuments({
          ...phoneUserQuery,
          verified: true,
          createdAt: { $gte: last7days }
        });
        const last30 = await PhoneUser.countDocuments({
          ...phoneUserQuery,
          verified: true,
          createdAt: { $gte: last30days }
        });
        const last90 = await PhoneUser.countDocuments({
          ...phoneUserQuery,
          verified: true,
          createdAt: { $gte: last90days }
        });

        console.log('\nPhoneUser (by createdAt):');
        console.log(`  Last 7 days:  ${last7}`);
        console.log(`  Last 30 days: ${last30}`);
        console.log(`  Last 90 days: ${last90}`);
        console.log(`  All time:     ${verifiedPhoneUsers}`);
      }

      // VerifiedUser date ranges
      if (verifiedUserCount > 0) {
        const last7 = await VerifiedUser.countDocuments({
          ...verifiedUserQuery,
          verified_at: { $gte: last7days }
        });
        const last30 = await VerifiedUser.countDocuments({
          ...verifiedUserQuery,
          verified_at: { $gte: last30days }
        });
        const last90 = await VerifiedUser.countDocuments({
          ...verifiedUserQuery,
          verified_at: { $gte: last90days }
        });

        console.log('\nVerifiedUser (by verified_at):');
        console.log(`  Last 7 days:  ${last7}`);
        console.log(`  Last 30 days: ${last30}`);
        console.log(`  Last 90 days: ${last90}`);
        console.log(`  All time:     ${verifiedUserCount}`);
      }
    }

    // Simulate API call
    console.log('\n\n🔄 Simulating API Response...');
    console.log('-'.repeat(80));

    // Get leads the same way the API does
    const phoneLeads = await PhoneUser.find({
      chatbotId: TARGET_CHATBOT_ID,
      verified: true,
      phone: { $exists: true, $ne: null, $ne: "" }
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('phone verified createdAt updatedAt');

    const verifiedLeads = await VerifiedUser.find({
      chatbot_id: chatbotObjectId,
      phone: { $exists: true, $ne: null, $ne: "" }
    })
      .sort({ verified_at: -1 })
      .limit(20)
      .select('phone verified_at provider session_id');

    // Combine and deduplicate
    const phoneMap = new Map();

    phoneLeads.forEach(lead => {
      phoneMap.set(lead.phone, {
        id: String(lead._id),
        phone: lead.phone,
        verified: lead.verified,
        verifiedAt: lead.createdAt,
        source: 'phone_verification'
      });
    });

    verifiedLeads.forEach(lead => {
      if (!phoneMap.has(lead.phone) || new Date(lead.verified_at) > new Date(phoneMap.get(lead.phone).verifiedAt)) {
        phoneMap.set(lead.phone, {
          id: String(lead._id),
          phone: lead.phone,
          verified: true,
          verifiedAt: lead.verified_at,
          provider: lead.provider,
          sessionId: lead.session_id,
          source: 'verified_user'
        });
      }
    });

    const combinedLeads = Array.from(phoneMap.values())
      .sort((a, b) => new Date(b.verifiedAt) - new Date(a.verifiedAt));

    console.log(`\nCombined unique leads (what API would return): ${combinedLeads.length}`);

    if (combinedLeads.length > 0) {
      console.log('\n📦 Sample API Response Structure:');
      console.log(JSON.stringify({
        success: true,
        status: 200,
        message: 'Success',
        data: {
          leads: combinedLeads.slice(0, 3), // Show first 3
          total: combinedLeads.length,
          currentPage: 1,
          totalPages: Math.ceil(combinedLeads.length / 10)
        }
      }, null, 2));
    }

    // Final Summary
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 FINAL SUMMARY FOR CHATBOT', TARGET_CHATBOT_ID);
    console.log('='.repeat(80));

    const totalLeads = Math.max(verifiedPhoneUsers, 0) + verifiedUserCount;

    if (totalLeads === 0) {
      console.log('❌ NO VERIFIED PHONE NUMBERS FOUND');
      console.log('\n💡 Possible reasons:');
      console.log('  1. No users have verified their phone numbers yet');
      console.log('  2. Wrong chatbot ID (double-check the ID is correct)');
      console.log('  3. Data is in a different collection or format');
      console.log('\n📝 To fix:');
      console.log('  • Verify phone numbers through your chatbot');
      console.log('  • Check if users are being recorded in the database');
      console.log('  • Ensure the chatbot ID matches your user account');
    } else {
      console.log(`✅ FOUND ${combinedLeads.length} UNIQUE VERIFIED PHONE NUMBERS`);
      console.log(`   - PhoneUser: ${verifiedPhoneUsers} verified`);
      console.log(`   - VerifiedUser: ${verifiedUserCount} with phone`);
      console.log(`   - Combined Unique: ${combinedLeads.length}`);

      if (combinedLeads.length > 0) {
        console.log('\n✅ These should appear in the leads page!');
        console.log('\n🔍 If they don\'t appear, check:');
        console.log('  1. Browser console for errors');
        console.log('  2. Network tab for /api/user/leads request');
        console.log('  3. Make sure you\'re logged in as the correct user');
        console.log('  4. Try changing the date range filter to 90 days');
      }
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

checkChatbotLeads();
