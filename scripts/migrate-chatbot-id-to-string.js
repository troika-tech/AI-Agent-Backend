// migrate-chatbot-id-to-string.js
const mongoose = require("mongoose");

const MONGODB_URI = "mongodb+srv://troika_pratik_2001:uAo1a8UND6sO2J3u@chatbot.tgmlyji.mongodb.net/?retryWrites=true&w=majority&appName=chatbot"; // 🔁 Change this
const COLLECTION_NAME = "embeddingchunks"; // 🔁 Use your actual collection name

// Generic flexible schema (non-strict)
const EmbeddingChunkSchema = new mongoose.Schema({}, { strict: false });
const EmbeddingChunk = mongoose.model("EmbeddingChunk", EmbeddingChunkSchema, COLLECTION_NAME);

async function runMigration() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    const result = await EmbeddingChunk.updateMany(
      { chatbot_id: { $type: "objectId" } },
      [
        {
          $set: {
            chatbot_id: { $toString: "$chatbot_id" }
          }
        }
      ]
    );

    console.log(`🔁 Modified ${result.modifiedCount} documents.`);
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");
  }
}

runMigration();
