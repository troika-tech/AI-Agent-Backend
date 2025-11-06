// services/adminService.js
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const Admin = require("../models/Admin");
const Company = require("../models/Company");
const Chatbot = require("../models/Chatbot");
const Message = require("../models/Message");

async function login({ email, password }) {
  // Check admin
  const admin = await Admin.findOne({ email });
  if (admin) {
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) return { unauthorized: true };
    const token = jwt.sign({ id: admin._id, email: admin.email, role: "admin", isSuperAdmin: admin.isSuperAdmin }, process.env.JWT_SECRET, { expiresIn: "8h" });
    return {
      role: "admin",
      token,
      user: { id: admin._id, email: admin.email, name: admin.name, isSuperAdmin: admin.isSuperAdmin },
    };
  }

  // Else check company
  const company = await Company.findOne({ email: email.toLowerCase() });
  if (company) {
    const match = await bcrypt.compare(password, company.password_hash);
    if (!match) return { unauthorized: true };
    const token = jwt.sign({ id: company._id, email: company.email, role: "user" }, process.env.JWT_SECRET, { expiresIn: "8h" });
    return { role: "user", token, user: { id: company._id, email: company.email, name: company.name } };
  }

  return { unauthorized: true };
}

async function stats() {
  const totalCompanies = await Company.countDocuments();
  const totalChatbots = await Chatbot.countDocuments();
  const sessions = await Message.distinct("session_id");
  const unique_users = sessions.length;
  const totalMessages = await Message.countDocuments();
  const currentMonth = new Date().getMonth();
  const chatbots = await Chatbot.find({}, "used_tokens last_reset");
  const monthlyTokenUsage = chatbots.reduce((sum, bot) => {
    const resetMonth = new Date(bot.last_reset).getMonth();
    return resetMonth === currentMonth ? sum + (bot.used_tokens || 0) : sum;
  }, 0);
  return { totalCompanies, totalChatbots, unique_users, totalMessages, monthlyTokenUsage };
}

async function createAdmin({ name, email, password, isSuperAdmin = false }) {
  const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
  if (existingAdmin) return { conflict: true };
  const hashedPassword = await bcrypt.hash(password, 10);
  const newAdmin = new Admin({ name, email: email.toLowerCase(), password_hash: hashedPassword, isSuperAdmin, created_at: new Date() });
  await newAdmin.save();
  return { admin: { id: newAdmin._id, name: newAdmin.name, email: newAdmin.email, isSuperAdmin: newAdmin.isSuperAdmin, created_at: newAdmin.created_at } };
}

async function editAdmin(id, { name, email, password }) {
  const updatePayload = {};
  if (name) updatePayload.name = name;
  if (email) updatePayload.email = email.toLowerCase();
  if (password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    updatePayload.password_hash = hashedPassword;
  }
  const updatedAdmin = await Admin.findByIdAndUpdate(id, updatePayload, { new: true });
  return { updated: !!updatedAdmin };
}

async function getAllAdmins() {
  const admins = await Admin.find().select("name email created_at isSuperAdmin").lean().sort({ created_at: -1 });
  return admins.map((a) => ({ ...a, testField: "Hello from the server!" }));
}

async function deleteAdmin(id) {
  const admin = await Admin.findByIdAndDelete(id);
  return { deleted: !!admin };
}

async function toggleSuperAdmin(id) {
  const admin = await Admin.findById(id);
  if (!admin) return { notFound: true };
  admin.isSuperAdmin = !admin.isSuperAdmin;
  await admin.save();
  return { isSuperAdmin: admin.isSuperAdmin };
}

module.exports = {
  login,
  stats,
  createAdmin,
  editAdmin,
  getAllAdmins,
  deleteAdmin,
  toggleSuperAdmin,
};
