// routes/subscription.js
const express = require("express");
const router = express.Router();
const Subscription = require("../models/Subscription");
const Message = require("../models/Message");
const VerifiedUser = require("../models/VerifiedUser");

router.get("/", async (req, res) => {
  try {
    // 1) Load subs with minimal public chatbot & plan fields
    const subscriptionsRaw = await Subscription.find()
      .populate("chatbot_id", "name company_name company_url token_limit used_tokens")
      .populate("plan_id", "name duration_days price max_users")
      .lean();

    // 2) Filter out subs that failed to populate chatbot (deleted/missing)
    const subscriptions = subscriptionsRaw.filter((s) => s.chatbot_id && s.chatbot_id._id);

    // Early return if nothing valid
    if (subscriptions.length === 0) {
      return res.json({ subscriptions: [] });
    }

    const chatbotIds = subscriptions.map((s) => s.chatbot_id._id);

    // 3) Aggregate message counts per chatbot
    const messageStats = await Message.aggregate([
      { $match: { chatbot_id: { $in: chatbotIds } } },
      { $group: { _id: "$chatbot_id", total_messages: { $sum: 1 } } },
    ]);

    // 4) Aggregate unique verified user counts per chatbot
    //    Use coalesced identifier (email or phone). Exclude docs with neither.
    const verifiedStats = await VerifiedUser.aggregate([
      { $match: { chatbot_id: { $in: chatbotIds } } },
      {
        $addFields: {
          _idKey: { $ifNull: ["$email", "$phone"] },
        },
      },
      { $match: { _idKey: { $ne: null } } },
      {
        $group: {
          _id: "$chatbot_id",
          unique_users_set: { $addToSet: "$_idKey" },
        },
      },
      {
        $project: {
          unique_users: { $size: "$unique_users_set" },
        },
      },
    ]);

    // 5) Make quick lookup maps
    const messagesMap = Object.fromEntries(
      messageStats.map((m) => [String(m._id), m.total_messages])
    );
    const verifiedMap = Object.fromEntries(
      verifiedStats.map((v) => [String(v._id), v.unique_users])
    );

    // 6) Enrich subscriptions safely
    const enrichedSubs = subscriptions.map((sub) => {
      const cb = sub.chatbot_id;
      const id = String(cb._id);
      return {
        ...sub,
        chatbot_id: {
          ...cb,
          total_messages: messagesMap[id] || 0,
          unique_users: verifiedMap[id] || 0,
        },
      };
    });

    res.json({ subscriptions: enrichedSubs });
  } catch (err) {
    console.error("Error fetching subscriptions:", err);
    res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
});

module.exports = router;
