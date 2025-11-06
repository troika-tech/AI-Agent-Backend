/**
 * Configuration file for knowledge base testing scripts
 * 
 * Update these values to match your environment and testing needs
 */

module.exports = {
  // Database configuration
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database'
  },
  
  // Test chatbot ID - replace with an actual chatbot ID from your database
  testChatbotId: process.env.TEST_CHATBOT_ID || '507f1f77bcf86cd799439011',
  
  // Test queries - customize these based on your knowledge base content
  testQueries: [
    // Product-related queries
    "What products do you have?",
    "What are your best-selling products?",
    "Do you have any sales or discounts?",
    "What is the price range of your products?",
    
    // Shipping and delivery
    "How much does shipping cost?",
    "How long does delivery take?",
    "Do you offer express shipping?",
    "Do you ship internationally?",
    
    // Customer service
    "What is your return policy?",
    "How can I contact customer support?",
    "What are your business hours?",
    "Do you have a live chat?",
    
    // Account and orders
    "How do I create an account?",
    "How can I track my order?",
    "Can I cancel my order?",
    "What payment methods do you accept?",
    
    // Company information
    "What is your company about?",
    "Where are you located?",
    "How long have you been in business?",
    "What makes you different?",
    
    // Technical support
    "How do I use your product?",
    "Do you have a mobile app?",
    "What browsers do you support?",
    "How do I reset my password?",
    
    // Policies
    "What is your privacy policy?",
    "What are your terms of service?",
    "What is your warranty policy?",
    "Do you have a refund policy?"
  ],
  
  // Test parameters
  testParams: {
    maxChunks: 5,
    similarityThreshold: 0.7,
    maxHistoryMessages: 3,
    delayBetweenTests: 500, // milliseconds
    maxContextLength: 4000 // characters
  },
  
  // Output configuration
  output: {
    saveReports: true,
    reportDirectory: 'test-reports',
    verboseLogging: true,
    showChunkContent: true,
    showSystemPrompt: true
  }
};
