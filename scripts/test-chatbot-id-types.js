const mongoose = require("mongoose");

// Replace with your MongoDB URI
const MONGODB_URI = "mongodb+srv://troika_pratik_2001:uAo1a8UND6sO2J3u@chatbot.tgmlyji.mongodb.net/?retryWrites=true&w=majority&appName=chatbot"; // change this!

// Define minimal schema for testing
const EmbeddingChunkSchema = new mongoose.Schema({}, { strict: false });
const EmbeddingChunk = mongoose.model("EmbeddingChunk", EmbeddingChunkSchema, "embeddingchunks"); // use your collection name

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ MongoDB connected");

    const chunks = await EmbeddingChunk.find().limit(5);

    const info = chunks.map(c => ({
      id: c._id,
      chatbot_id: c.chatbot_id,
      chatbot_id_str: c.chatbot_id?.toString(),
      type: typeof c.chatbot_id,
      isObjectId: mongoose.Types.ObjectId.isValid(c.chatbot_id) && c.chatbot_id instanceof mongoose.Types.ObjectId,
    }));

    console.log("📦 Sample EmbeddingChunk entries:\n", info);

    await mongoose.disconnect();
    console.log("✅ Done & disconnected");
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

run();
