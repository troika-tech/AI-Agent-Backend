// Load dotenv if not already loaded
if (!process.env.OPENAI_API_KEY && !process.env.NODE_ENV) {
  require('dotenv').config();
}

const OpenAI = require('openai');

// Check if API key is configured
if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️  Warning: OPENAI_API_KEY environment variable is not set');
  console.warn('   Some features requiring OpenAI will not work.');
  console.warn('   Please set OPENAI_API_KEY in your .env file\n');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-dummy-key-for-initialization'
});

module.exports = openai;

