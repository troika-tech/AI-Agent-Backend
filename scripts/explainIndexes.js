require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../db');

require('../models/Message');
require('../models/Embedding');
require('../models/Subscription');

(async () => {
  try {
    await connectDB();

    const Message = mongoose.model('Message');
    const Subscription = mongoose.model('Subscription');

    // Sample parameters; optionally override via env vars
    const CHATBOT_ID = process.env.EXPLAIN_CHATBOT_ID ? new mongoose.Types.ObjectId(process.env.EXPLAIN_CHATBOT_ID) : undefined;
    const SESSION_ID = process.env.EXPLAIN_SESSION_ID;
    const SENDER = process.env.EXPLAIN_SENDER || 'user';

    console.log('Running explain on representative queries...');

    const queries = [];

    if (CHATBOT_ID && SESSION_ID) {
      queries.push({
        name: 'Message history by chatbot+session sorted by timestamp desc',
        coll: Message.collection,
        filter: { chatbot_id: CHATBOT_ID, session_id: SESSION_ID },
        sort: { timestamp: -1 },
      });
    }

    if (CHATBOT_ID) {
      queries.push({
        name: 'Messages by chatbot+sender sorted by timestamp desc',
        coll: Message.collection,
        filter: { chatbot_id: CHATBOT_ID, sender: SENDER },
        sort: { timestamp: -1 },
      });
      queries.push({
        name: 'Guest message count per chatbot',
        coll: Message.collection,
        filter: { chatbot_id: CHATBOT_ID, is_guest: true, sender: 'user' },
        sort: undefined,
      });
    }

    if (SESSION_ID) {
      queries.push({
        name: 'Session messages sorted by timestamp desc',
        coll: Message.collection,
        filter: { session_id: SESSION_ID },
        sort: { timestamp: -1 },
      });
    }

    // Subscription lookup
    if (CHATBOT_ID) {
      queries.push({
        name: 'Subscription lookup by chatbot+status',
        coll: Subscription.collection,
        filter: { chatbot_id: CHATBOT_ID, status: 'active' },
      });
    }

    for (const q of queries) {
      console.log(`\n--- ${q.name} ---`);
      let cursor = q.coll.find(q.filter || {});
      if (q.sort) cursor = cursor.sort(q.sort);
      const plan = await cursor.explain('executionStats');
      const execStats = plan?.executionStats || {};
      console.log('winningPlan:', plan.queryPlanner?.winningPlan);
      console.log('nReturned:', execStats.nReturned, 'totalDocsExamined:', execStats.totalDocsExamined, 'totalKeysExamined:', execStats.totalKeysExamined, 'execTimeMs:', execStats.executionTimeMillis);
    }

    console.log('\n✅ Explain finished');
  } catch (err) {
    console.error('❌ Explain failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
})();
