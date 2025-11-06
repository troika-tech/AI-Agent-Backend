// models/AzaModel.js
const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  productId: { type: String },
  title: { type: String, required: true },
  description: { type: String, default: "" },
  url: { type: String },
  image: { type: String },
  price: { type: String },
  priceNum: { type: Number },
  currency: { type: String, default: "INR" },
  in_stock: { type: Boolean, default: true },
  available_sizes: { type: [String], default: [] },
  colors: { type: [String], default: [] },
  scrapedAt: { type: Date, default: Date.now },
  searchText: { type: String, default: "" },
  embedding: { type: [Number], default: null }
}, { timestamps: true });

// Derived / enrichment fields (populated by enrichment script)
ProductSchema.add({
  materials: { type: [String], default: [] },
  category: { type: String, default: null },
  subCategories: { type: [String], default: [] },
  isKids: { type: Boolean, default: false },
  gender: { type: String, enum: ['men','women','unisex',null], default: null },
  occasion: { type: [String], default: [] },
  tokens: { type: [String], default: [] },
  tokensVersion: { type: Number, default: 0 }
});

ProductSchema.index({ searchText: 'text' });
ProductSchema.index({ productId: 1 });
ProductSchema.index({ priceNum: 1 });
ProductSchema.index({ in_stock: 1 });

// model name AzaModel, collection forced to 'azaproducts'
module.exports = mongoose.model('AzaModel', ProductSchema, 'azaproducts');
