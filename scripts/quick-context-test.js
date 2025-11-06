#!/usr/bin/env node

/**
 * Quick interactive test for knowledge base retrieval and context building
 * 
 * Usage:
 * node scripts/quick-context-test.js
 * 
 * Then enter queries interactively to test context retrieval
 */

const mongoose = require('mongoose');
const readline = require('readline');
const { retrieveRelevantChunks } = require('../services/queryService');
const Chatbot = require('../models/Chatbot');
const Message = require('../models/Message');

// Set API key directly for testing (REMOVE AFTER TESTING)
process.env.OPENAI_API_KEY = 'apikey'; // Replace with your actual API key

// Configuration
const TEST_CHATBOT_ID = process.env.TEST_CHATBOT_ID || '688068d45ba526540d784b24';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongo uri');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
}

async function testQuery(query, chatbotId) {
  console.log(`\n🔍 Testing: "${query}"`);
  console.log('=' .repeat(60));
  
  try {
    // 1. Retrieve chunks
    console.log('\n📚 Retrieving knowledge base chunks...');
    const chunks = await retrieveRelevantChunks(query, chatbotId, 5, 0.7);
    
    if (!chunks || chunks.length === 0) {
      console.log('❌ No chunks found');
      return;
    }
    
    console.log(`✅ Found ${chunks.length} chunks:`);
    chunks.forEach((chunk, index) => {
      console.log(`\n📄 Chunk ${index + 1} (Score: ${chunk.score?.toFixed(3) || 'N/A'}):`);
      console.log(chunk.content);
      console.log('-'.repeat(50));
    });
    
    // 2. Get chatbot info
    const chatbot = await Chatbot.findById(chatbotId).lean();
    console.log(`\n🤖 Chatbot: ${chatbot?.name || 'Unknown'}`);
    console.log(`   Custom persona: ${chatbot?.persona_text ? 'Yes' : 'No'}`);
    
    // 3. Build context
    const contextChunks = chunks.map(chunk => chunk.content).filter(content => content && content.trim().length > 20);
    const context = contextChunks.join("\n---\n");
    
    console.log(`\n🔧 Context built (${context.length} chars):`);
    console.log(context);
    
    // 4. Get recent history
    const recentMessages = await Message.find({ chatbot_id: chatbotId })
      .sort({ timestamp: -1 })
      .limit(3)
      .lean();
    
    if (recentMessages.length > 0) {
      console.log(`\n💬 Recent history (${recentMessages.length} messages):`);
      recentMessages.forEach((msg, index) => {
        console.log(`   ${index + 1}. [${msg.sender}]: ${msg.content}`);
      });
    }
    
    // 5. Build system prompt
    const systemPrompt = `${chatbot?.persona_text || 'Default persona'}

--- CONTEXT FROM KNOWLEDGE BASE ---
${context}
`;
    
    console.log(`\n🎭 System prompt (${systemPrompt.length} chars):`);
    console.log(systemPrompt);
    
    // 6. Build messages array
    const historyContext = recentMessages.reverse().map((msg) => ({
      role: msg.sender === "user" ? "user" : "bot",
      content: msg.content,
    }));
    
    const messages = [
      { role: "system", content: systemPrompt },
      ...historyContext,
      { role: "user", content: query },
    ];
    
    console.log(`\n📋 Complete messages array (${messages.length} messages):`);
    messages.forEach((msg, index) => {
      console.log(`\n[${index + 1}] ${msg.role.toUpperCase()}:`);
      console.log(msg.content);
      console.log('-'.repeat(30));
    });
    
    console.log('\n✅ Test completed!');
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

async function startInteractiveTest() {
  console.log('🧪 Quick Context Test Tool');
  console.log('==========================');
  console.log(`Using chatbot ID: ${TEST_CHATBOT_ID}`);
  console.log('\nEnter queries to test (type "exit" to quit):');
  
  await connectToDatabase();
  
  const askQuestion = () => {
    rl.question('\n💬 Enter your query: ', async (query) => {
      if (query.toLowerCase() === 'exit') {
        console.log('\n👋 Goodbye!');
        await mongoose.disconnect();
        rl.close();
        return;
      }
      
      if (query.trim()) {
        await testQuery(query.trim(), TEST_CHATBOT_ID);
      }
      
      askQuestion();
    });
  };
  
  askQuestion();
}

// Handle command line usage
if (require.main === module) {
  startInteractiveTest().catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
}

module.exports = { testQuery, startInteractiveTest };
