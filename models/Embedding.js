const mongoose = require("mongoose");
const { EMBEDDING_MODEL } = require('../lib/embed');

const embeddingChunkSchema = new mongoose.Schema({
  chatbot_id: { type: String },
  company_id: { type: String },
  content: { type: String, required: true },
  embedding: { type: [Number], required: true }, // OpenAI vector
  embedding_length: { type: Number, default: 0 },
  model: { type: String, default: EMBEDDING_MODEL, index: true },
  status: { type: String, default: 'ready', index: true },
  language: { type: String, default: 'en', index: true },
  hash: { type: String, index: true, required: true },
}, {
  timestamps: true,
  collection: 'embeddingchunks',
});

embeddingChunkSchema.index({ chatbot_id: 1, hash: 1 }, { unique: true });
embeddingChunkSchema.index({ company_id: 1, hash: 1 }, { unique: false });
embeddingChunkSchema.index({ company_id: 1, language: 1 });

embeddingChunkSchema.pre('save', function updateEmbeddingLength(next) {
  if (Array.isArray(this.embedding)) {
    this.embedding_length = this.embedding.length;
  }
  next();
});

module.exports = mongoose.model("EmbeddingChunk", embeddingChunkSchema);
