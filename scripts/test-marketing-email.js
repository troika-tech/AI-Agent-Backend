// Test script for WhatsApp Marketing Proposal Email
require('dotenv').config();
const { sendWhatsAppMarketingProposal } = require('../services/emailService');

async function testEmail() {
  console.log('🧪 Testing WhatsApp Marketing Proposal Email...\n');
  console.log('📧 Sending to: pratik.yesare68@gmail.com');
  console.log('📤 From:', process.env.RESEND_FROM);
  console.log('🔑 API Key configured:', !!process.env.RESEND_API_KEY);
  console.log('\n⏳ Sending email...\n');

  try {
    const result = await sendWhatsAppMarketingProposal('pratik.yesare68@gmail.com');

    if (result) {
      console.log('✅ SUCCESS! Email sent successfully!');
      console.log('📬 Check your inbox at pratik.yesare68@gmail.com');
    } else {
      console.log('❌ FAILED! Email could not be sent.');
      console.log('Check the logs above for errors.');
    }
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error);
  }
}

testEmail();
