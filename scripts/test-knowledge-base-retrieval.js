#!/usr/bin/env node

/**
 * Test script for knowledge base retrieval and LLM context passing
 * 
 * This script allows you to test:
 * 1. Knowledge base chunk retrieval based on queries
 * 2. Context building and formatting
 * 3. Complete LLM input structure
 * 
 * Usage:
 * node scripts/test-knowledge-base-retrieval.js
 * 
 * Or with specific query:
 * node scripts/test-knowledge-base-retrieval.js "What products do you have?"
 */

const mongoose = require('mongoose');
const { retrieveRelevantChunks } = require('../services/queryService');
const { generateAnswer } = require('../services/chatService');
const Chatbot = require('../models/Chatbot');
const Message = require('../models/Message');
const logger = require('../utils/logger');

// Set API key directly for testing (REMOVE AFTER TESTING)
process.env.OPENAI_API_KEY = 'sk-proj-your-api-key-here'; // Replace with your actual API key

// Test queries - you can modify these or add more
const TEST_QUERIES = [
  "What products do you have?",
  "How much does shipping cost?",
  "What is your return policy?",
  "Do you have customer support?",
  "What are your business hours?",
  "How can I track my order?",
  "What payment methods do you accept?",
  "Do you offer international shipping?",
  "What is your warranty policy?",
  "How do I create an account?",
  "Can I cancel my order?",
  "What is your privacy policy?",
  "How do I contact support?",
  "What are your terms of service?",
  "Do you have a mobile app?"
];

// Test chatbot ID - you may need to change this to an actual chatbot ID from your database
const TEST_CHATBOT_ID = process.env.TEST_CHATBOT_ID || '507f1f77bcf86cd799439011'; // Replace with actual chatbot ID

async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
}

async function testKnowledgeBaseRetrieval(query, chatbotId) {
  console.log(`\n🔍 Testing Query: "${query}"`);
  console.log('=' .repeat(80));
  
  try {
    // Test 1: Retrieve relevant chunks
    console.log('\n📚 Step 1: Retrieving knowledge base chunks...');
    const chunks = await retrieveRelevantChunks(query, chatbotId, 5, 0.7);
    
    if (!chunks || chunks.length === 0) {
      console.log('❌ No chunks retrieved from knowledge base');
      return;
    }
    
    console.log(`✅ Retrieved ${chunks.length} chunks:`);
    chunks.forEach((chunk, index) => {
      console.log(`\n📄 Chunk ${index + 1}:`);
      console.log(`   Length: ${chunk.content?.length || 0} characters`);
      console.log(`   Content: ${chunk.content?.substring(0, 200)}${chunk.content?.length > 200 ? '...' : ''}`);
      if (chunk.score) {
        console.log(`   Relevance Score: ${chunk.score}`);
      }
    });
    
    // Test 2: Get chatbot configuration
    console.log('\n🤖 Step 2: Fetching chatbot configuration...');
    const chatbot = await Chatbot.findById(chatbotId).lean();
    if (!chatbot) {
      console.log('❌ Chatbot not found');
      return;
    }
    
    console.log(`✅ Chatbot found: ${chatbot.name || 'Unnamed'}`);
    console.log(`   Persona: ${chatbot.persona_text ? 'Custom persona set' : 'Using default persona'}`);
    console.log(`   Product feature: ${chatbot.product_feature_enabled ? 'Enabled' : 'Disabled'}`);
    
    // Test 3: Get recent chat history
    console.log('\n💬 Step 3: Fetching recent chat history...');
    const recentMessages = await Message.find({ chatbot_id: chatbotId })
      .sort({ timestamp: -1 })
      .limit(5)
      .lean();
    
    console.log(`✅ Found ${recentMessages.length} recent messages`);
    if (recentMessages.length > 0) {
      console.log('   Recent messages:');
      recentMessages.slice(0, 3).forEach((msg, index) => {
        console.log(`   ${index + 1}. [${msg.sender}]: ${msg.content?.substring(0, 100)}${msg.content?.length > 100 ? '...' : ''}`);
      });
    }
    
    // Test 4: Simulate context building (like in generateAnswer)
    console.log('\n🔧 Step 4: Building context for LLM...');
    
    const contextChunks = chunks
      .map((chunk) => chunk.content?.trim())
      .filter((content) => content && content.length > 0);
    const seenChunks = new Set();
    const cleanedChunks = [];
    contextChunks.forEach((content) => {
      if (!seenChunks.has(content)) {
        seenChunks.add(content);
        cleanedChunks.push(content);
      }
    });

    const topChunks = cleanedChunks.slice(0, 5);
    const context = topChunks.join("\n---\n");
    
    console.log(`✅ Context built with ${topChunks.length} chunks`);
    console.log(`   Total context length: ${context.length} characters`);
    console.log(`   Context preview: ${context.substring(0, 300)}${context.length > 300 ? '...' : ''}`);
    
    // Test 5: Build history context
    console.log('\n📜 Step 5: Building history context...');
    const historyContext = recentMessages.reverse().map((msg) => ({
      role: msg.sender === "user" ? "user" : "bot",
      content: msg.content,
    }));
    
    const uniqueHistory = [];
    const seenMessages = new Set();
    for (const message of historyContext) {
      if (message.content && !seenMessages.has(message.content)) {
        uniqueHistory.push(message);
        seenMessages.add(message.content);
      }
    }
    
    let trimmedHistory = uniqueHistory;
    if (uniqueHistory.length > 10) {
      trimmedHistory = uniqueHistory.slice(-10);
    }
    
    console.log(`✅ History context built with ${trimmedHistory.length} messages`);
    
    // Test 6: Build system prompt
    console.log('\n🎭 Step 6: Building system prompt...');
    const chatbotPersona = chatbot.persona_text;
    const fallbackPersona = `
You are Supa Agent — a friendly, professional, and knowledgeable company representative.
Your role is to:
- Explain what the company offers, how it works, and where it can be used.
- Make the concept easy to understand, and encourage users to explore the product or service.
INSTRUCTIONS:
- ONLY elaborate when the user explicitly asks for more detail (e.g., "explain", "how", "details", "steps", "examples").
- Stick to role: Never say you're an AI. For details not in your knowledge base, direct users to company support channels.
- Do NOT provide any links.
`;
    
    const systemPrompt = `${chatbotPersona || fallbackPersona}

--- CONTEXT FROM KNOWLEDGE BASE ---
${context}
`;
    
    console.log(`✅ System prompt built`);
    console.log(`   Length: ${systemPrompt.length} characters`);
    console.log(`   Has custom persona: ${!!chatbotPersona}`);
    console.log(`   System prompt preview: ${systemPrompt.substring(0, 500)}${systemPrompt.length > 500 ? '...' : ''}`);
    
    // Test 7: Build complete messages array
    console.log('\n📋 Step 7: Building complete messages array...');
    const messages = [
      { role: "system", content: systemPrompt },
      ...trimmedHistory,
      { role: "user", content: query },
    ];
    
    console.log(`✅ Messages array built with ${messages.length} messages`);
    console.log(`   Message roles: ${messages.map(m => m.role).join(' -> ')}`);
    
    // Test 8: Display complete LLM input
    console.log('\n🚀 Step 8: Complete LLM Input Structure:');
    console.log('=' .repeat(80));
    console.log('MESSAGES ARRAY:');
    messages.forEach((msg, index) => {
      console.log(`\n[${index + 1}] Role: ${msg.role}`);
      console.log(`Content Length: ${msg.content?.length || 0} characters`);
      console.log('Content:');
      console.log('-'.repeat(40));
      console.log(msg.content);
      console.log('-'.repeat(40));
    });
    
    // Test 9: Test actual LLM call (optional - uncomment to test)
    console.log('\n🤖 Step 9: Testing actual LLM call...');
    console.log('⚠️  Skipping actual LLM call to avoid API costs');
    console.log('   Uncomment the code below to test actual LLM response');
    
    /*
    try {
      const { answer, tokens } = await generateAnswer(
        query,
        topChunks,
        {}, // clientConfig
        trimmedHistory,
        chatbotId,
        "No specific products were found for this query.", // productContext
        false, // productFeatureEnabled
        chatbot // botDoc
      );
      
      console.log(`✅ LLM Response generated`);
      console.log(`   Tokens used: ${tokens}`);
      console.log(`   Response: ${answer}`);
    } catch (error) {
      console.log(`❌ LLM call failed: ${error.message}`);
    }
    */
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error(`❌ Error during test: ${error.message}`);
    console.error(error.stack);
  }
}

async function runTests() {
  console.log('🧪 Knowledge Base Retrieval Test Suite');
  console.log('=====================================');
  
  await connectToDatabase();
  
  // Get query from command line argument or use test queries
  const queryArg = process.argv[2];
  const queriesToTest = queryArg ? [queryArg] : TEST_QUERIES;
  
  console.log(`\n📝 Testing ${queriesToTest.length} queries with chatbot ID: ${TEST_CHATBOT_ID}`);
  
  for (let i = 0; i < queriesToTest.length; i++) {
    const query = queriesToTest[i];
    await testKnowledgeBaseRetrieval(query, TEST_CHATBOT_ID);
    
    // Add delay between tests to avoid overwhelming the system
    if (i < queriesToTest.length - 1) {
      console.log('\n⏳ Waiting 2 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n🎉 All tests completed!');
  console.log('\n💡 Tips:');
  console.log('   - Check if retrieved chunks are relevant to the query');
  console.log('   - Verify context is properly formatted and complete');
  console.log('   - Ensure system prompt includes all necessary information');
  console.log('   - Monitor token usage if testing actual LLM calls');
  
  await mongoose.disconnect();
  console.log('\n👋 Disconnected from MongoDB');
}

// Handle command line usage
if (require.main === module) {
  runTests().catch(error => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = { testKnowledgeBaseRetrieval, runTests };
