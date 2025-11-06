require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../db');
const { vectorSearchByText } = require('../services/vectorSearch');

(async () => {
  try {
    const text = 'what is website cost?';
    const chatbotId = "688068d45ba526540d784b24";
    const k = 5;

    await connectDB();
    console.log('Using database:', mongoose.connection.db.databaseName);

    const results = await vectorSearchByText({ text, chatbotId, k, fields: ['content', 'chatbot_id'] });

    console.log(`Top ${k} results for:`, text);
    results.forEach((r, i) => {
      console.log(`#${i + 1}`, {
        content: (r.content || '').slice(0, 120) + (r.content?.length > 120 ? '…' : ''),
        chatbot_id: r.chatbot_id,
        score: r.score ?? r._score
      });
    });
  } catch (err) {
    console.error('❌ Smoke vector search failed:', err?.response?.data || err.message || err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
})();
