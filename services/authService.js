// services/authService.js
// Focused auth helpers for company (user) login
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const Company = require("../models/Company");

async function loginCompany({ email, password }) {
  const company = await Company.findOne({ email: String(email).toLowerCase() });
  if (!company) return { unauthorized: true };
  const ok = await bcrypt.compare(password, company.password_hash);
  if (!ok) return { unauthorized: true };
  const token = jwt.sign({ id: company._id, email: company.email, role: "user" }, process.env.JWT_SECRET, { expiresIn: "8h" });
  return { token, user: { id: company._id, name: company.name, email: company.email } };
}

module.exports = { loginCompany };
