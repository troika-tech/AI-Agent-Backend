/**
 * Quick script to check if there's phone data in the database
 *
 * Usage: node check-phone-data.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB connection string from your .env file
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot';

async function checkPhoneData() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

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

    // Check PhoneUser collection
    console.log('📊 Checking PhoneUser collection...');
    const phoneUserCount = await PhoneUser.countDocuments();
    console.log(`Total PhoneUser records: ${phoneUserCount}`);

    const verifiedPhoneUsers = await PhoneUser.countDocuments({ verified: true });
    console.log(`Verified PhoneUser records: ${verifiedPhoneUsers}`);

    if (verifiedPhoneUsers > 0) {
      console.log('\n📱 Sample verified PhoneUser records:');
      const samples = await PhoneUser.find({ verified: true }).limit(5);
      samples.forEach((record, index) => {
        console.log(`\n${index + 1}. Phone: ${record.phone}`);
        console.log(`   Chatbot ID: ${record.chatbotId}`);
        console.log(`   Verified: ${record.verified}`);
        console.log(`   Created: ${record.createdAt}`);
      });
    }

    // Check VerifiedUser collection
    console.log('\n📊 Checking VerifiedUser collection...');
    const verifiedUserCount = await VerifiedUser.countDocuments();
    console.log(`Total VerifiedUser records: ${verifiedUserCount}`);

    const verifiedWithPhone = await VerifiedUser.countDocuments({
      phone: { $exists: true, $ne: null, $ne: "" }
    });
    console.log(`VerifiedUser records with phone: ${verifiedWithPhone}`);

    if (verifiedWithPhone > 0) {
      console.log('\n📱 Sample VerifiedUser records with phone:');
      const samples = await VerifiedUser.find({
        phone: { $exists: true, $ne: null, $ne: "" }
      }).limit(5);
      samples.forEach((record, index) => {
        console.log(`\n${index + 1}. Phone: ${record.phone}`);
        console.log(`   Chatbot ID: ${record.chatbot_id}`);
        console.log(`   Provider: ${record.provider}`);
        console.log(`   Verified At: ${record.verified_at}`);
      });
    }

    // Get unique chatbot IDs
    console.log('\n🤖 Checking Chatbot IDs...');
    const phoneUserChatbots = await PhoneUser.distinct('chatbotId');
    const verifiedUserChatbots = await VerifiedUser.distinct('chatbot_id');

    console.log('Chatbot IDs in PhoneUser:', phoneUserChatbots.length > 0 ? phoneUserChatbots : 'None');
    console.log('Chatbot IDs in VerifiedUser:', verifiedUserChatbots.length > 0 ? verifiedUserChatbots : 'None');

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 SUMMARY');
    console.log('='.repeat(60));
    if (verifiedPhoneUsers === 0 && verifiedWithPhone === 0) {
      console.log('❌ No verified phone numbers found in database');
      console.log('\n💡 This is why the leads page shows "No verified phone numbers found"');
      console.log('\n📝 To add test data, you can:');
      console.log('1. Have users verify their phone through your chatbot');
      console.log('2. Manually insert test data using MongoDB Compass');
      console.log('3. Run a seed script to populate test data');
    } else {
      console.log(`✅ Found ${verifiedPhoneUsers + verifiedWithPhone} verified phone records`);
      console.log('\n⚠️  If leads page is empty, check:');
      console.log('1. The chatbot_id in your user account matches the data');
      console.log('2. The date range filter (try 90 days)');
      console.log('3. Browser console for API errors');
    }
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Check .env file has MONGODB_URI');
    console.error('2. Verify MongoDB is running');
    console.error('3. Check connection string is correct');
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

checkPhoneData();
