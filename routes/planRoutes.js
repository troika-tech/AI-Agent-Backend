const express = require("express");
const router = express.Router();
const Plan = require("../models/Plan"); // Make sure this path is correct

// GET /plans - Fetch all plans ordered by duration_days
router.get("/", async (req, res) => {
  try {
    const plans = await Plan.find().sort({ duration_days: 1 }); // ascending
    res.json({ plans });
  } catch (error) {
    console.error("Error fetching plans:", error);
    res.status(500).json({ message: "Failed to fetch plans" });
  }
});

module.exports = router;
