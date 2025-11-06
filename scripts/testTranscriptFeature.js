#!/usr/bin/env node
/**
 * Transcript Feature Diagnostic Script
 * Tests all components of the conversation transcript feature
 *
 * Usage:
 *   node scripts/testTranscriptFeature.js
 *
 * Or with specific phone:
 *   node scripts/testTranscriptFeature.js 9876543210
 */

require('dotenv').config();
const mongoose = require('mongoose');
const generatePDFBuffer = require('../pdf/historyPDFBuffer');
const { uploadToS3, checkS3Access } = require('../utils/s3Uploader');
const { sendConversationTranscript } = require('../utils/sendConversationTranscript');
const Message = require('../models/Message');
const logger = require('../utils/logger');

const TEST_PHONE = process.argv[2] || '9876543210';
const TEST_SESSION_ID = `test-${Date.now()}`;

async function runDiagnostics() {
  console.log('\n='.repeat(60));
  console.log('📋 CONVERSATION TRANSCRIPT FEATURE DIAGNOSTICS');
  console.log('='.repeat(60));

  const results = {
    env: false,
    db: false,
    s3: false,
    pdf: false,
    whatsapp: false,
    endToEnd: false
  };

  // Test 1: Environment Variables
  console.log('\n1️⃣ Testing Environment Variables...');
  try {
    const required = [
      'MONGODB_URI',
      'AISENSY_API_KEY',
      'AISENSY_ORG_SLUG',
      'AWS_ACCESS_KEY_ID',
      'AWS_SECRET_ACCESS_KEY',
      'AWS_S3_BUCKET',
      'AWS_REGION'
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      console.error('❌ Missing environment variables:', missing.join(', '));
      results.env = false;
    } else {
      console.log('✅ All required environment variables present');
      console.log(`   - AISENSY_ORG_SLUG: ${process.env.AISENSY_ORG_SLUG}`);
      console.log(`   - AWS_S3_BUCKET: ${process.env.AWS_S3_BUCKET}`);
      console.log(`   - AWS_REGION: ${process.env.AWS_REGION}`);
      results.env = true;
    }
  } catch (error) {
    console.error('❌ Error checking environment:', error.message);
  }

  // Test 2: Database Connection
  console.log('\n2️⃣ Testing Database Connection...');
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if Message model is accessible
    const count = await Message.countDocuments();
    console.log(`   - Total messages in DB: ${count}`);

    // Check messages with phone
    const withPhone = await Message.countDocuments({ phone: { $exists: true, $ne: null } });
    const withoutPhone = await Message.countDocuments({ $or: [{ phone: null }, { phone: { $exists: false } }] });
    console.log(`   - Messages with phone: ${withPhone}`);
    console.log(`   - Messages without phone: ${withoutPhone}`);

    if (withoutPhone > 0) {
      console.warn(`   ⚠️  ${withoutPhone} messages without phone number (may cause query issues)`);
    }

    results.db = true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    results.db = false;
  }

  // Test 3: S3 Access
  console.log('\n3️⃣ Testing S3 Access...');
  try {
    const accessible = await checkS3Access();
    if (accessible) {
      console.log('✅ S3 bucket is accessible');
      console.log(`   - Bucket: ${process.env.AWS_S3_BUCKET}`);
      console.log(`   - Region: ${process.env.AWS_REGION}`);
      results.s3 = true;
    } else {
      console.error('❌ S3 bucket not accessible');
      console.error('   Check AWS credentials and bucket permissions');
      results.s3 = false;
    }
  } catch (error) {
    console.error('❌ S3 access test failed:', error.message);
    results.s3 = false;
  }

  // Test 4: PDF Generation
  console.log('\n4️⃣ Testing PDF Generation...');
  try {
    const testMessages = [
      { sender: 'User', text: 'Hello, I need help with my order', timestamp: new Date() },
      { sender: 'Assistant', text: 'Of course! I\'d be happy to help you with your order. Could you please provide your order number?', timestamp: new Date() },
      { sender: 'User', text: 'It\'s #12345', timestamp: new Date() },
      { sender: 'Assistant', text: 'Thank you! Let me look that up for you...', timestamp: new Date() }
    ];

    console.log(`   - Generating PDF with ${testMessages.length} messages...`);

    const pdfBuffer = await generatePDFBuffer({
      messages: testMessages,
      sessionId: TEST_SESSION_ID,
      phone: TEST_PHONE,
      generatedAt: new Date()
    });

    if (Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 0) {
      console.log(`✅ PDF generated successfully`);
      console.log(`   - Size: ${pdfBuffer.length} bytes (${(pdfBuffer.length / 1024).toFixed(2)} KB)`);
      console.log(`   - Valid PDF signature: ${pdfBuffer.slice(0, 4).toString('ascii')}`);
      results.pdf = true;

      // Test 5: S3 Upload
      if (results.s3) {
        console.log('\n5️⃣ Testing S3 Upload...');
        try {
          const s3Key = `test-transcripts/${TEST_SESSION_ID}.pdf`;
          const s3Url = await uploadToS3(pdfBuffer, s3Key);

          if (s3Url) {
            console.log('✅ PDF uploaded to S3 successfully');
            console.log(`   - URL: ${s3Url}`);
            results.s3Upload = true;
          } else {
            console.error('❌ S3 upload returned null');
          }
        } catch (error) {
          console.error('❌ S3 upload failed:', error.message);
        }
      }
    } else {
      console.error('❌ PDF generation failed or returned invalid buffer');
      results.pdf = false;
    }
  } catch (error) {
    console.error('❌ PDF generation failed:', error.message);
    console.error('   This might be due to:');
    console.error('   - Missing Puppeteer/Chromium installation');
    console.error('   - Missing system dependencies');
    console.error('   - Template file not found');
    console.error(`   - Error details: ${error.stack}`);
    results.pdf = false;
  }

  // Test 6: WhatsApp Send (if we have a valid PDF URL)
  if (results.s3Upload) {
    console.log('\n6️⃣ Testing WhatsApp Send...');
    console.log(`   ⚠️  This will send a real WhatsApp message to ${TEST_PHONE}`);
    console.log('   - Press Ctrl+C to cancel, or wait 5 seconds to proceed...');

    await new Promise(resolve => setTimeout(resolve, 5000));

    try {
      // Use the S3 URL from the previous test
      const testPdfUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/test-transcripts/${TEST_SESSION_ID}.pdf`;

      const result = await sendConversationTranscript(
        TEST_PHONE,
        testPdfUrl,
        TEST_SESSION_ID
      );

      if (result.success) {
        console.log('✅ WhatsApp message sent successfully');
        console.log(`   - Phone: ${TEST_PHONE}`);
        console.log(`   - Session: ${TEST_SESSION_ID}`);
        results.whatsapp = true;
      } else {
        console.error('❌ WhatsApp send failed:', result.error);
        console.error('   This might be due to:');
        console.error('   - Template "chatsummarytemp" not found in AiSensy');
        console.error('   - Invalid phone number format');
        console.error('   - AiSensy API issues');
        results.whatsapp = false;
      }
    } catch (error) {
      console.error('❌ WhatsApp send test failed:', error.message);
      results.whatsapp = false;
    }
  } else {
    console.log('\n6️⃣ Skipping WhatsApp Send Test (no valid PDF URL)');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 DIAGNOSTIC SUMMARY');
  console.log('='.repeat(60));
  console.log(`Environment Variables:  ${results.env ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Database Connection:    ${results.db ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`S3 Access:              ${results.s3 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`PDF Generation:         ${results.pdf ? '✅ PASS' : '❌ FAIL'}`);
  if (results.s3Upload !== undefined) {
    console.log(`S3 Upload:              ${results.s3Upload ? '✅ PASS' : '❌ FAIL'}`);
  }
  if (results.whatsapp !== undefined) {
    console.log(`WhatsApp Send:          ${results.whatsapp ? '✅ PASS' : '❌ FAIL'}`);
  }
  console.log('='.repeat(60));

  const allPassed = results.env && results.db && results.s3 && results.pdf;

  if (allPassed) {
    console.log('\n✅ All core components working! Transcript feature should work in production.');
  } else {
    console.log('\n❌ Some components failed. Please fix the issues above.');
    console.log('\nCommon Fixes:');
    if (!results.env) console.log('   - Check .env file and ensure all variables are set');
    if (!results.db) console.log('   - Verify MongoDB connection string and network access');
    if (!results.s3) console.log('   - Check AWS credentials and S3 bucket permissions');
    if (!results.pdf) console.log('   - Install Puppeteer dependencies: apt-get install -y chromium-browser');
  }

  console.log('\n');

  // Cleanup
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  }

  process.exit(allPassed ? 0 : 1);
}

// Run diagnostics
runDiagnostics().catch(error => {
  console.error('\n💥 Fatal error running diagnostics:', error);
  process.exit(1);
});
