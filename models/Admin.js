// src/models/Admin.js

const mongoose = require("mongoose");

const AdminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  name: { type: String, default: "" },
  isSuperAdmin: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
});

// ADDED: Mongoose pre-save hook to enforce super admin limit
AdminSchema.pre("save", async function (next) {
  // 'this' refers to the admin document being saved
  
  // We only need to run this check if the 'isSuperAdmin' field is being set to true
  if (this.isModified("isSuperAdmin") && this.isSuperAdmin) {
    // 'this.constructor' refers to the Admin model itself
    const count = await this.constructor.countDocuments({ isSuperAdmin: true });
    
    if (count >= 3) {
      // If there are already 3 or more super admins, block the save
      // by passing an error to the next() function.
      const err = new Error("Super admin limit reached. Cannot add more than 3.");
      return next(err);
    }
  }
  
  // If the check passes, proceed with the save operation.
  next();
});

module.exports = mongoose.model("Admin", AdminSchema);
