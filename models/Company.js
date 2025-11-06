const mongoose = require("mongoose");

const CompanySchema = new mongoose.Schema({
  name: { type: String, required: true },
  url: { type: String, required: true }, // ❌ remove unique
  email: { type: String, required: true, unique: true }, // ✅ unique email only
  password_hash: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

// If you still want to prevent same company from using same URL + email combo,
// add a compound index instead of unique on url:
CompanySchema.index({ url: 1, email: 1 }, { unique: true });

module.exports = mongoose.model("Company", CompanySchema);
