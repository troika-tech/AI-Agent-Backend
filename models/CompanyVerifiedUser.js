const mongoose = require("mongoose");

const CompanyVerifiedUserSchema = new mongoose.Schema({
  company_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true
  },
  email: {
    type: String,
    required: true
  },
  verified_at: {
    type: Date,
    default: Date.now
  },
  session_id: {
    type: String
  }
});

// ✅ Index for faster lookup by company
CompanyVerifiedUserSchema.index({ company_id: 1 });

module.exports = mongoose.model("CompanyVerifiedUser", CompanyVerifiedUserSchema);
