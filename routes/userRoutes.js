const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");
const { validate } = require("../middleware/validation");
const userSchemas = require("../schemas/user");

// Public routes (no auth)
router.post("/login", userController.loginUser);

router.use(authMiddleware.protect); // Ensure token-based auth

router.get("/company", userController.getUserCompany);
router.get("/plan", userController.getUserPlan);
router.get("/usage", userController.getUserUsage);
router.get("/analytics", userController.getUserAnalytics);
// GET /api/user/messages - supports query params: page, limit, email, phone, session_id, is_guest
router.get("/messages", validate(userSchemas.getUserMessages), userController.getUserMessages);
router.get("/sessions", userController.getUserSessions);

// MORE SPECIFIC ROUTES FIRST (to avoid :email catching them)
router.get(
  "/messages/session/:session_id/pdf",
  userController.downloadUserChatBySession
);
router.get(
  "/messages/phone/:phone/pdf",
  validate(userSchemas.phoneParam),
  userController.downloadUserChatByPhone
);
router.get(
  "/messages/download-emails-and-phone-numbers",
  userController.downloadEmailsAndPhoneNumbersCSV
);
router.get(
  "/messages/unique-emails-and-phones",
  userController.getUniqueEmailsAndPhones
);
router.get(
  "/messages/unique-emails-and-phones-from-messages",
  userController.getUniqueEmailsAndPhonesFromMessages
);
router.get(
  "/messages/download-all-emails-and-phone-numbers",
  userController.downloadAllEmailsAndPhoneNumbersFromMessages
);

// Leads endpoints
router.get("/leads", userController.getVerifiedPhoneLeads);
router.get("/collected-leads", userController.getCollectedLeads);

// Top users and chat history endpoints
router.get("/top-users", userController.getTopUsers);
router.get("/chat-history", userController.getUserChatHistory);

// GENERIC EMAIL-PDF ROUTE LAST
router.get("/messages/:email/pdf", validate(userSchemas.emailParam), userController.downloadUserChatByEmail);

// Report
router.get("/report/download", userController.downloadUserReport);

module.exports = router;
