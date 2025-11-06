const express = require("express");
const router = express.Router();

const {
  createChatbot,
  editChatbot,
  deleteChatbot,
  getMessageHistory,
  updateTokenLimit,
  getAllChatbotsWithStats,
  downloadChatbotReport,
  getPersona,
  updatePersona,
} = require("../controllers/chatbotController");

const {
  getClientConfig,
  updateClientConfig,
} = require("../controllers/clientConfigController");

const {
  getSubscription,
  renewSubscription,
} = require("../controllers/subscriptionController");

const { protect, restrictTo, restrictToRoles } = require("../middleware/authMiddleware"); // ✅ NEW

// Core chatbot routes
router.post("/create", protect, restrictTo("admin"), createChatbot);
router.put("/edit/:id", protect, restrictTo("admin"), editChatbot);
router.delete("/delete/:id", protect, restrictTo("admin"), deleteChatbot);
router.get("/all", protect, restrictTo("admin"), getAllChatbotsWithStats);
router.get("/download/:chatbotId", protect, restrictTo("admin"), downloadChatbotReport);
router.get("/messages/:id", protect, restrictTo("admin"), getMessageHistory);
router.put(
  "/update-token-limit/:id",
  protect,
  restrictTo("admin"),
  updateTokenLimit
);

// Subscription routes (admin only)
router.get("/:id/subscription", protect, restrictToRoles("admin", "user"), getSubscription);
router.post("/:id/renew", protect, restrictTo("admin"), renewSubscription);

// Client config routes (⚠️ not protected — optionally secure if needed)
router.get("/:id/config", getClientConfig);
router.put("/:id/config", updateClientConfig);


router.get("/:id/persona", protect, restrictTo("admin"), getPersona);
router.put("/:id/persona", protect, restrictTo("admin"), updatePersona);

module.exports = router;
