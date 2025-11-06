require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../db');

// Import models so their indexes are registered
require('../models/Message');
require('../models/Embedding');
require('../models/Subscription');

(async () => {
  try {
    await connectDB();

    const Message = mongoose.model('Message');
    const EmbeddingChunk = mongoose.model('EmbeddingChunk');
    const Subscription = mongoose.model('Subscription');

    console.log('Ensuring indexes...');
    const models = [Message, EmbeddingChunk, Subscription];

    for (const Model of models) {
      console.time(`syncIndexes ${Model.modelName}`);
      await Model.syncIndexes(); // Creates indexes defined in schema, drops removed
      console.timeEnd(`syncIndexes ${Model.modelName}`);
      const existing = await Model.collection.indexes();
      console.log(`${Model.modelName} indexes:`, existing.map(i => i.name));
    }

    console.log('✅ Index sync complete');
  } catch (err) {
    console.error('❌ Index creation failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
})();
