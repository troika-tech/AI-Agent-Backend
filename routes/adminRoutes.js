const express = require("express");
const router = express.Router();
const {
  login,
  getStats,
  createAdmin,
  editAdmin,
  getAllAdmins,
  deleteAdmin, // 👈 ADD THIS
  toggleSuperAdmin, // 👈 ADD THIS
} = require("../controllers/adminController");

const Admin = require("../models/Admin");

// ✅ Import middleware
const { protect, restrictTo, restrictToSuperAdmin } = require("../middleware/authMiddleware");

// 🔓 Public login route
router.post("/login", login);

// 🔐 Protected routes
router.get("/stats", protect, restrictTo("admin"), getStats);

// 🔐 Super Admin routes
router.post("/create", protect, restrictToSuperAdmin, createAdmin);
router.put("/update/:id", protect, restrictToSuperAdmin, editAdmin);

router.delete("/delete/:id", protect, restrictToSuperAdmin, deleteAdmin);
router.put("/toggle-role/:id", protect, restrictToSuperAdmin, toggleSuperAdmin);

// This route now correctly uses the controller function
router.get("/all", protect, restrictToSuperAdmin, getAllAdmins);

module.exports = router;
