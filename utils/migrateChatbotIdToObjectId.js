const mongoose = require("mongoose");
require('dotenv').config({ path: __dirname + '/../.env' });  // adjust path as needed


const EmbeddingChunk = require("../models/Embedding"); // Adjust path as needed

async function migrateChatbotId() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");

    // Find documents where chatbot_id is a string (not ObjectId)
    const docsToUpdate = await EmbeddingChunk.find({
      chatbot_id: { $type: "string" },
    });

    console.log(`Found ${docsToUpdate.length} documents to update.`);

    for (const doc of docsToUpdate) {
      try {
        // Convert string to ObjectId
        const newObjectId = new mongoose.Types.ObjectId(doc.chatbot_id);

        // Update document with new ObjectId
        doc.chatbot_id = newObjectId;
        await doc.save();

        console.log(`Updated doc ${doc._id} chatbot_id to ObjectId.`);
      } catch (e) {
        console.error(`Failed to update doc ${doc._id}:`, e.message);
      }
    }

    console.log("Migration complete.");
    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

migrateChatbotId();
