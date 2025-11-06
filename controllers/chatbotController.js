const Chatbot = require("../models/Chatbot");
const Company = require("../models/Company");
const Plan = require("../models/Plan");
const Subscription = require("../models/Subscription");
const Message = require("../models/Message");
const VerifiedUser = require("../models/VerifiedUser");
const UserSession = require("../models/UserSession");
const generatePDFBuffer = require("../pdf/generatePDFBuffer");
const defaultSuggestions = require("../constants/defaultSuggestions");
const ClientConfig = require("../models/ClientConfig");
const NotificationSettings = require("../models/NotificationSettings");
const ChatbotCustomization = require("../models/ChatbotCustomization");
const logger = require('../utils/logger');
const { deleteChatbotCascade } = require('../services/cascadeDelete');

// Import error handling utilities
const ApiError = require("../utils/ApiError");
const { sendSuccessResponse, sendErrorResponse } = require("../utils/responseFormatter");
const { catchAsync } = require("../middleware/errorHandler");
const { validateBody } = require("../utils/validationHelpers");

// CREATE chatbot
exports.createChatbot = catchAsync(async (req, res) => {
  if (!validateBody(req, res)) return;

  const { companyId, name } = req.body;

  if (!companyId || !name) {
    logger.warn('Attempt to create chatbot with missing companyId or name');
    throw ApiError.badRequest("companyId and name are required");
  }

  const company = await Company.findById(companyId);
  if (!company) {
    logger.warn(`Company not found for id: ${companyId}`);
    throw ApiError.notFound("Company not found");
  }

  const chatbot = await new Chatbot({
    company_id: company._id,
    company_name: company.name,
    company_url: company.url,
    name,
  }).save();

  // Client UI defaults
  await ClientConfig.create({
    chatbot_id: chatbot._id,
    ui_suggestions: defaultSuggestions,
    link_intents: [],
  });

  // Seed NotificationSettings (email-only)
  await NotificationSettings.findOneAndUpdate(
    { chatbotId: chatbot._id, companyId: company._id },
    {
      $setOnInsert: {
        email: {
          enabled: true,
          recipients: [company.email],
          subjectTemplate: "New user authenticated",
          bodyTemplate:
            "A new user has signed in.\n\nUser: {{user}}\nProvider: {{provider}}\nIP: {{ip}}\nWhen: {{time}}",
          notifyEveryLogin: false,
        },
      },
    },
    { upsert: true, new: true }
  );

  // Seed default styling (uses schema defaults)
  await ChatbotCustomization.findOneAndUpdate(
    { chatbotId: chatbot._id },
    { $setOnInsert: { chatbotId: chatbot._id } },
    { upsert: true, new: true }
  );

  // Assign default subscription
  const DEFAULT_PLAN_ID = "6870e8271b41fee9aa61f01a";
  const plan = await Plan.findById(DEFAULT_PLAN_ID);
  if (!plan) {
    throw ApiError.notFound("Default plan not found");
  }

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + plan.duration_days);

  await Subscription.create({
    chatbot_id: chatbot._id,
    plan_id: plan._id,
    chatbot_name: chatbot.name,
    company_name: company.name,
    plan_name: plan.name,
    start_date: startDate,
    end_date: endDate,
    status: "active",
  });

  return sendSuccessResponse(res, chatbot, "Chatbot created with default plan, notification settings, and styling", 201);
});

// EDIT chatbot
exports.editChatbot = catchAsync(async (req, res) => {
  if (!validateBody(req, res)) return;

  const { id } = req.params;
  const { name } = req.body;

  if (!name) {
    throw ApiError.badRequest("Name is required");
  }

  const updated = await Chatbot.findByIdAndUpdate(
    id,
    { name },
    { new: true }
  );
  
  if (!updated) {
    throw ApiError.notFound("Chatbot not found");
  }

  return sendSuccessResponse(res, updated, "Chatbot updated successfully");
});

// DELETE chatbot (full cascade)
exports.deleteChatbot = catchAsync(async (req, res) => {
  const { id } = req.params;
  const summary = await deleteChatbotCascade(id);
  return sendSuccessResponse(res, { summary }, "Chatbot and related data deleted successfully");
});

// Get ALL chatbots with stats
exports.getAllChatbotsWithStats = catchAsync(async (req, res) => {
  const chatbots = await Chatbot.find();

  const enriched = await Promise.all(
    chatbots.map(async (bot) => {
      const uniqueUsers = await UserSession.countDocuments({
        chatbot_id: bot._id,
      });
      const totalMessages = await Message.countDocuments({
        chatbot_id: bot._id,
      });

      return {
        ...bot.toObject(),
        unique_users: uniqueUsers,
        total_messages: totalMessages,
      };
    })
  );

  return sendSuccessResponse(res, { chatbots: enriched }, "Chatbots with stats fetched successfully");
});

// 💬 Get chatbot message history
exports.getMessageHistory = async (req, res) => {
  const { id } = req.params;

  try {
    const { is_guest, limit = 100 } = req.query;
    
    const query = { chatbot_id: id };
    if (is_guest !== undefined) {
      query.is_guest = is_guest === 'true';
    }
    
    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));
    res.status(200).json({ messages });
  } catch (err) {
    console.error("Fetch messages error:", err.message);
    res.status(500).json({ message: "Error fetching message history" });
  }
};

// 🔁 Update token limit
exports.updateTokenLimit = async (req, res) => {
  if (!validateBody(req, res)) return;

  const { id } = req.params;
  const { token_limit } = req.body;

  try {
    const chatbot = await Chatbot.findByIdAndUpdate(
      id,
      { token_limit },
      { new: true }
    );
    if (!chatbot) return res.status(404).json({ message: "Chatbot not found" });

    res.json({ message: "Token limit updated", data: chatbot });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📦 Fetch all chatbots with message & user stats (utility for dashboard)
exports.fetchChatbotsWithStats = async () => {
  const chatbots = await Chatbot.find().populate("company_id");

  const enriched = await Promise.all(
    chatbots.map(async (bot) => {
      const messages = await Message.find({ chatbot_id: bot._id }).select(
        "session_id"
      );
      const recentMessages = await Message.find({ chatbot_id: bot._id })
        .sort({ timestamp: -1 })
        .limit(100)
        .select("sender content");

      const uniqueUsers = await UserSession.countDocuments({
        chatbot_id: bot._id,
      });
      const totalMessages = messages.length;

      return {
        ...bot.toObject(),
        unique_users: uniqueUsers,
        total_messages: totalMessages,
        company_email: bot.company_id?.email || null,
        company_name: bot.company_id?.name || null,
        message_history: recentMessages,
      };
    })
  );

  return enriched;
};

exports.downloadChatbotReport = async (req, res) => {
  try {
    const { chatbotId } = req.params;

    const chatbot = await Chatbot.findById(chatbotId);
    if (!chatbot) return res.status(404).json({ message: "Chatbot not found" });

    const company = await Company.findById(chatbot.company_id);

    const subscription = await Subscription.findOne({
      chatbot_id: chatbot._id,
    }).populate("plan_id");

    const allMessages = await Message.find({ chatbot_id: chatbot._id });
    const recentMessages = await Message.find({ chatbot_id: chatbot._id })
      .sort({ timestamp: -1 })
      .limit(100);

    const uniqueUsers = new Set(allMessages.map((m) => m.session_id)).size;

    const now = new Date();
    const expiry = new Date(subscription.end_date);
    const daysRemaining = Math.max(
      0,
      Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))
    );

    const data = {
      title: `Chatbot Report – ${chatbot.name}`,
      generatedOn: now.toLocaleString(),
      company: {
        name: chatbot.company_name,
        email: company?.email || "",
        domain: chatbot.company_url,
      },
      plan: {
        name: subscription.plan_id.name,
        duration_days: subscription.plan_id.duration_days,
        days_remaining: daysRemaining,
        max_users: subscription.plan_id.max_users,
        price: subscription.plan_id.price || 0,
        end_date: subscription.end_date,
      },
      usage: {
        total_messages: allMessages.length,
        unique_users: uniqueUsers,
      },
      messages: recentMessages,
    };

    const pdfBuffer = await generatePDFBuffer(data);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${chatbotId}-report.pdf"`,
    });

    res.send(pdfBuffer);
  } catch (err) {
    console.error("Admin PDF download error:", err);
    res.status(500).json({ message: "Failed to generate report" });
  }
};

// GET /chatbot/:id/persona
exports.getPersona = async (req, res) => {
  try {
    const chatbot = await Chatbot.findById(req.params.id).select("persona_text name");
    if (!chatbot) return res.status(404).json({ message: "Chatbot not found" });

    res.json({ persona: chatbot.persona_text || "" }); // 👈 map to `persona` for frontend
  } catch (err) {
    console.error("getPersona error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /chatbot/:id/persona
exports.updatePersona = async (req, res) => {
  if (!validateBody(req, res)) return;

  try {
    const { persona } = req.body; // frontend still sends `persona`
    if (typeof persona !== "string") {
      return res.status(400).json({ message: "Persona must be a string" });
    }

    const chatbot = await Chatbot.findByIdAndUpdate(
      req.params.id,
      { persona_text: persona }, // 👈 store in schema field
      { new: true }
    ).select("persona_text name");

    if (!chatbot) return res.status(404).json({ message: "Chatbot not found" });

    res.json({ message: "Persona updated", persona: chatbot.persona_text });
  } catch (err) {
    console.error("updatePersona error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
