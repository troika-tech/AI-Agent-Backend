// routes/customizations.js
const express = require("express");
const router = express.Router();
const { getCustomization, upsertCustomization, resetCustomizationToDefaults } = require("../controllers/customizationController");
const { protect, restrictToRoles } = require("../middleware/authMiddleware");

router.get("/:chatbotId", getCustomization);
router.put("/:chatbotId", protect, restrictToRoles("admin", "superadmin"), upsertCustomization);
router.post("/:chatbotId/reset", protect, restrictToRoles("admin", "superadmin"), resetCustomizationToDefaults);

module.exports = router;
