const express = require("express");
const router = express.Router();
const {
  createCompany,
  editCompany,
  deleteCompany,
  getAllCompaniesWithChatbots,
} = require("../controllers/companyController");

const { protect, restrictTo } = require("../middleware/authMiddleware"); // ✅

router.post("/create", protect, restrictTo("admin"), createCompany);
router.put("/update/:id", protect, restrictTo("admin"), editCompany);
router.delete("/delete/:id", protect, restrictTo("admin"), deleteCompany);
router.get("/all", protect, restrictTo("admin"), getAllCompaniesWithChatbots);

module.exports = router;
