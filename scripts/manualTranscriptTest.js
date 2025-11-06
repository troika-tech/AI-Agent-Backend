#!/usr/bin/env node
/**
 * Manual Transcript Test Script
 * Sends a test conversation transcript to WhatsApp
 *
 * Usage:
 *   node scripts/manualTranscriptTest.js <phone> <chatbotId>
 *
 * Example:
 *   node scripts/manualTranscriptTest.js 9876543210 65a1b2c3d4e5f6g7h8i9j0k1
 */

require('dotenv').config();
const mongoose = require('mongoose');
const generatePDFBuffer = require('../pdf/historyPDFBuffer');
const { uploadToS3 } = require('../utils/s3Uploader');
const { sendConversationTranscript } = require('../utils/sendConversationTranscript');
const logger = require('../utils/logger');

// Get command line arguments
const phone = process.argv[2];
const chatbotId = process.argv[3];

if (!phone) {
  console.error('❌ Error: Phone number is required');
  console.log('\nUsage: node scripts/manualTranscriptTest.js <phone> [chatbotId]');
  console.log('Example: node scripts/manualTranscriptTest.js 9876543210 65a1b2c3d4e5f6g7h8i9j0k1');
  process.exit(1);
}

// Sample conversation data
const sampleConversation = [
  {
    sender: 'User',
    text: 'Hi! I want to know more about your AI agents.',
    timestamp: new Date('2025-01-20T10:00:00Z')
  },
  {
    sender: 'Assistant',
    text: 'Hello! I\'d be happy to help you learn about our AI agents. We offer several types of AI solutions:\n\n1. **AI Supa Agent** - Intelligent chatbot for websites\n2. **AI Calling Agent** - Automated voice calling system\n3. **RCS Messaging** - Rich communication services\n4. **WhatsApp Marketing** - Automated WhatsApp campaigns\n\nWhich one would you like to know more about?',
    timestamp: new Date('2025-01-20T10:00:05Z')
  },
  {
    sender: 'User',
    text: 'Tell me about the AI Supa Agent',
    timestamp: new Date('2025-01-20T10:00:30Z')
  },
  {
    sender: 'Assistant',
    text: 'Great choice! The **AI Supa Agent** is our flagship chatbot solution:\n\n✨ **Key Features:**\n- 24/7 automated customer support\n- Natural language understanding\n- Seamless integration with your website\n- Multi-language support\n- Lead generation and qualification\n- Integration with CRM systems\n\n💰 **Pricing:**\nStarts from ₹9,999/month with customized plans available.\n\n🚀 **Benefits:**\n- Reduce customer service costs by 60%\n- Respond to inquiries instantly\n- Capture leads even when you\'re offline\n- Scale without hiring more support staff\n\nWould you like me to send you a detailed proposal?',
    timestamp: new Date('2025-01-20T10:00:35Z')
  },
  {
    sender: 'User',
    text: 'Yes, please send me the proposal!',
    timestamp: new Date('2025-01-20T10:01:00Z')
  },
  {
    sender: 'Assistant',
    text: 'Perfect! I\'ll send a detailed proposal to your WhatsApp number. You\'ll receive:\n\n📋 Complete feature list\n💵 Pricing breakdown\n📊 ROI calculator\n🎯 Implementation timeline\n📞 Free consultation scheduling link\n\nThe proposal will be sent to your WhatsApp shortly. Is there anything else you\'d like to know?',
    timestamp: new Date('2025-01-20T10:01:05Z')
  },
  {
    sender: 'User',
    text: 'No, that\'s all. Thank you!',
    timestamp: new Date('2025-01-20T10:01:20Z')
  },
  {
    sender: 'Assistant',
    text: 'You\'re welcome! Thank you for your interest in Troika Tech Services. We\'ll send the proposal to your WhatsApp and our team will follow up with you soon.\n\nHave a great day! 🚀',
    timestamp: new Date('2025-01-20T10:01:25Z')
  }
];

async function sendTestTranscript() {
  console.log('\n' + '='.repeat(70));
  console.log('📱 MANUAL TRANSCRIPT TEST');
  console.log('='.repeat(70));
  console.log(`\n📞 Phone: ${phone}`);
  console.log(`🤖 Chatbot ID: ${chatbotId || 'test-chatbot'}`);
  console.log(`📊 Messages: ${sampleConversation.length}`);
  console.log(`⏰ Test Session: manual-test-${Date.now()}`);
  console.log('\n' + '-'.repeat(70));

  const sessionId = `manual-test-${Date.now()}`;
  let pdfUrl = null;

  try {
    // Step 1: Generate PDF
    console.log('\n1️⃣ Generating PDF from sample conversation...');
    const pdfBuffer = await generatePDFBuffer({
      messages: sampleConversation,
      sessionId: sessionId,
      phone: phone,
      generatedAt: new Date()
    });

    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('PDF generation returned empty buffer');
    }

    console.log(`✅ PDF generated successfully`);
    console.log(`   Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`   Buffer type: ${Buffer.isBuffer(pdfBuffer) ? 'Valid Node.js Buffer' : 'Invalid'}`);

    // Step 2: Upload to S3
    console.log('\n2️⃣ Uploading PDF to S3...');
    const s3Key = `manual-test-transcripts/${sessionId}.pdf`;
    pdfUrl = await uploadToS3(pdfBuffer, s3Key);

    if (!pdfUrl) {
      throw new Error('S3 upload failed - returned null URL');
    }

    console.log(`✅ PDF uploaded to S3`);
    console.log(`   URL: ${pdfUrl}`);

    // Step 3: Send via WhatsApp
    console.log('\n3️⃣ Sending transcript via WhatsApp...');
    console.log(`   Campaign: chatsummarytempsumm`);
    console.log(`   Template: chatsummarytemp`);
    console.log(`   Phone: ${phone}`);
    console.log('\n   ⏳ Sending...');

    const result = await sendConversationTranscript(
      phone,
      pdfUrl,
      sessionId,
      {
        campaignName: 'chatsummarytempsumm',
        templateName: 'chatsummarytemp',
        companyName: 'Troika Tech Services'
      }
    );

    console.log('\n' + '='.repeat(70));
    if (result.success) {
      console.log('✅ SUCCESS! Transcript sent successfully');
      console.log('='.repeat(70));
      console.log('\n📱 Check your WhatsApp for the PDF transcript');
      console.log(`📄 PDF URL: ${pdfUrl}`);
      console.log(`🆔 Session ID: ${sessionId}`);
      console.log(`📞 Phone: ${phone}`);
      console.log('\n✨ If you received the message, the transcript feature is working!');
    } else {
      console.log('❌ FAILED to send transcript');
      console.log('='.repeat(70));
      console.log(`\n⚠️ Error: ${result.error}`);
      console.log('\nPossible causes:');
      console.log('1. AiSensy template "chatsummarytemp" does not exist');
      console.log('2. Template is not configured for document/PDF media');
      console.log('3. Invalid phone number format');
      console.log('4. AiSensy API key issues');
      console.log('\n📋 Next steps:');
      console.log('- Login to AiSensy dashboard: https://backend.api-wa.co/');
      console.log('- Check if template "chatsummarytemp" exists');
      console.log('- Verify template has document/media support');
      console.log(`- Check AiSensy API logs for errors`);
    }
    console.log('\n');

  } catch (error) {
    console.log('\n' + '='.repeat(70));
    console.log('❌ ERROR OCCURRED');
    console.log('='.repeat(70));
    console.error(`\n💥 Error: ${error.message}`);
    console.error(`\n📚 Stack trace:\n${error.stack}`);

    // Provide specific guidance based on error
    if (error.message.includes('Puppeteer') || error.message.includes('chromium')) {
      console.log('\n🔧 FIX: Install Puppeteer dependencies');
      console.log('   On Ubuntu/Debian:');
      console.log('   sudo apt-get update');
      console.log('   sudo apt-get install -y chromium-browser');
      console.log('\n   Or install full Puppeteer (includes Chromium):');
      console.log('   npm install puppeteer');
    } else if (error.message.includes('S3') || error.message.includes('AWS')) {
      console.log('\n🔧 FIX: Check AWS credentials');
      console.log('   - Verify AWS_ACCESS_KEY_ID in .env');
      console.log('   - Verify AWS_SECRET_ACCESS_KEY in .env');
      console.log('   - Check S3 bucket permissions');
      console.log('   - Ensure bucket exists: troika-conversation-pdfs');
    } else if (error.message.includes('template')) {
      console.log('\n🔧 FIX: Check EJS template');
      console.log('   - Ensure pdf/history.ejs exists');
      console.log('   - Check file permissions');
    }
    console.log('\n');
  }

  console.log('-'.repeat(70));
  console.log('Test completed.\n');
  process.exit(0);
}

// Show conversation preview
console.log('\n📝 Sample Conversation Preview:');
console.log('-'.repeat(70));
sampleConversation.forEach((msg, idx) => {
  const preview = msg.text.length > 60 ? msg.text.substring(0, 60) + '...' : msg.text;
  console.log(`${idx + 1}. [${msg.sender}] ${preview}`);
});

// Confirm before sending
console.log('\n' + '='.repeat(70));
console.log('⚠️  This will send a REAL WhatsApp message to: ' + phone);
console.log('='.repeat(70));
console.log('\nPress Ctrl+C to cancel, or wait 3 seconds to proceed...\n');

setTimeout(() => {
  sendTestTranscript().catch(error => {
    console.error('\n💥 Fatal error:', error.message);
    process.exit(1);
  });
}, 3000);
