// services/userService.js
const Chatbot = require("../models/Chatbot");
const Message = require("../models/Message");
const Subscription = require("../models/Subscription");
const Company = require("../models/Company");
const VerifiedUser = require("../models/VerifiedUser");
const generatePDFBuffer = require("../pdf/generatePDFBuffer");
const json2csv = require("json2csv").parse;
const { getMessagesSchema } = require("../schemas/serviceSchemas");

const { deriveWindowFromSubscription, makeDateFilter } = require("../utils/dateHelpers");

async function getChatbotByCompany(companyId) {
  return Chatbot.findOne({ company_id: companyId });
}

async function getUserPlanSummary(companyId) {
  const chatbot = await getChatbotByCompany(companyId);
  if (!chatbot) return { notFound: true };

  const subscription = await Subscription.findOne({ chatbot_id: chatbot._id })
    .sort({ end_date: -1 })
    .populate("plan_id");
  if (!subscription) return { notFound: true };

  const now = new Date();
  const expiry = new Date(subscription.end_date);
  const remaining = Math.max(0, Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)));
  const duration_days = Math.ceil((subscription.end_date - subscription.start_date) / (1000 * 60 * 60 * 24));

  return {
    chatbot,
    plan: {
      name: subscription.plan_id.name,
      tokens: subscription.plan_id.tokens,
      duration_days,
      max_users: subscription.plan_id.max_users,
      activation_date: subscription.start_date,
      expiry_date: subscription.end_date,
      days_remaining: remaining,
    },
  };
}

async function countUniqueVerifiedUsers(chatbotId, window = null) {
  const match = {
    chatbot_id: chatbotId,
    ...(window ? { verified_at: { $gte: window.start, $lte: window.end } } : {}),
  };

  const agg = await VerifiedUser.aggregate([
    { $match: match },
    {
      $addFields: {
        email_lc: {
          $cond: [
            { $and: [{ $ifNull: ["$email", false] }, { $ne: ["$email", ""] }] },
            { $toLower: "$email" },
            null,
          ],
        },
      },
    },
    {
      $project: {
        key: {
          $cond: [
            { $and: [{ $ifNull: ["$email_lc", false] }, { $ne: ["$email_lc", ""] }] },
            { $concat: ["email:", "$email_lc"] },
            {
              $cond: [
                { $and: [{ $ifNull: ["$phone", false] }, { $ne: ["$phone", ""] }] },
                { $concat: ["phone:", "$phone"] },
                null,
              ],
            },
          ],
        },
      },
    },
    { $match: { key: { $ne: null } } },
    { $group: { _id: "$key" } },
    { $count: "count" },
  ]);

  return agg[0]?.count ?? 0;
}

async function getVerifiedEmailsAndPhones(chatbotId, window = null) {
  const baseMatch = {
    chatbot_id: chatbotId,
    ...(window ? { verified_at: { $gte: window.start, $lte: window.end } } : {}),
  };

  const emailsAgg = await VerifiedUser.aggregate([
    { $match: { ...baseMatch, email: { $exists: true, $ne: null, $ne: "" } } },
    { $group: { _id: { $toLower: "$email" } } },
    { $project: { _id: 0, email: "$_id" } },
  ]);
  const emails = emailsAgg.map((e) => e.email);

  const phoneNumbers = await VerifiedUser.distinct("phone", {
    ...baseMatch,
    phone: { $exists: true, $ne: null, $ne: "" },
  });

  return { emails, phoneNumbers };
}

async function getUsage(companyId) {
  console.log("🔍 [getUsage] Called with companyId:", companyId);

  const chatbot = await getChatbotByCompany(companyId);
  if (!chatbot) {
    console.log("❌ [getUsage] Chatbot not found for companyId:", companyId);
    return { notFound: true };
  }
  console.log("✅ [getUsage] Chatbot found:", chatbot._id);

  // Count ALL messages for this chatbot, not just within subscription window
  const msgMatch = { chatbot_id: chatbot._id };
  console.log("🔍 [getUsage] Message match query:", JSON.stringify(msgMatch));

  // Get unique sessions (session_id count) instead of verified users
  const uniqueSessionIds = await Message.distinct("session_id", msgMatch);
  const unique_users = uniqueSessionIds.length;
  console.log("👥 [getUsage] Unique session IDs found:", uniqueSessionIds.length);
  console.log("📋 [getUsage] Session IDs:", uniqueSessionIds);

  const [total_messages, tokensAgg, lastMsg] = await Promise.all([
    Message.countDocuments(msgMatch),
    Message.aggregate([{ $match: msgMatch }, { $group: { _id: null, sum: { $sum: { $ifNull: ["$token_count", 0] } } } }]),
    Message.findOne(msgMatch).sort({ timestamp: -1 }).select("timestamp"),
  ]);
  const used_tokens = tokensAgg[0]?.sum ?? 0;

  console.log("📊 [getUsage] Usage results:");
  console.log("  - Total messages:", total_messages);
  console.log("  - Unique users (sessions):", unique_users);
  console.log("  - Used tokens:", used_tokens);
  console.log("  - Last activity:", lastMsg?.timestamp);

  return { chatbot, usage: { total_messages, unique_users, used_tokens, last_activity: lastMsg?.timestamp || null } };
}

async function getMessages(companyId, params = {}) {
  const chatbot = await getChatbotByCompany(companyId);
  if (!chatbot) return { notFound: true };
  const { value, error } = getMessagesSchema.validate(params, { convert: true, stripUnknown: true });
  if (error) {
    return { notFound: true, validationError: error.details?.map((d) => d.message).join(", ") };
  }
  const { page, limit, email, phone, is_guest, session_id, dateRange } = value;
  const skip = (page - 1) * limit;
  const query = { chatbot_id: chatbot._id };
  if (email) query.email = email;
  if (phone) query.phone = phone;
  if (is_guest !== undefined) query.is_guest = is_guest === true || is_guest === 'true';
  if (session_id) query.session_id = session_id;

  // Add date range filter
  if (dateRange && dateRange !== "all") {
    const now = new Date();
    let cutoffDate = new Date();

    if (dateRange === "custom") {
      // Use custom start and end dates if provided
      const { startDate, endDate } = params;
      if (startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.timestamp = { $gte: start, $lte: end };
      }
    } else {
      switch (dateRange) {
        case "7days":
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case "30days":
          cutoffDate.setDate(now.getDate() - 30);
          break;
        case "90days":
          cutoffDate.setDate(now.getDate() - 90);
          break;
        default:
          cutoffDate.setDate(now.getDate() - 7);
      }

      query.timestamp = { $gte: cutoffDate };
    }
  }

  const [messages, total] = await Promise.all([
    Message.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit),
    Message.countDocuments(query),
  ]);

  return { chatbot, messages, total, page, totalPages: Math.ceil(total / limit) };
}

async function getSessions(companyId, dateRange = null, startDate = null, endDate = null) {
  const chatbot = await getChatbotByCompany(companyId);
  if (!chatbot) return { notFound: true };

  // Calculate date filter
  let dateFilter = {};
  if (dateRange && dateRange !== "all") {
    const now = new Date();
    let cutoffDate = new Date();

    if (dateRange === "custom" && startDate && endDate) {
      // Use custom start and end dates
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = { timestamp: { $gte: start, $lte: end } };
    } else {
      switch (dateRange) {
        case "7days":
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case "30days":
          cutoffDate.setDate(now.getDate() - 30);
          break;
        case "90days":
          cutoffDate.setDate(now.getDate() - 90);
          break;
        default:
          cutoffDate.setDate(now.getDate() - 7);
      }

      dateFilter = { timestamp: { $gte: cutoffDate } };
    }
  }

  const sessionIds = await Message.distinct("session_id", {
    chatbot_id: chatbot._id,
    ...dateFilter
  });

  let totalDurationSeconds = 0;
  let sessionsWithDuration = 0;

  const sessions = await Promise.all(
    sessionIds.map(async (sessionId) => {
      // Get messages for this session within the date range
      const messages = await Message.find({
        chatbot_id: chatbot._id,
        session_id: sessionId,
        ...dateFilter
      }).sort({ timestamp: 1 });

      // Calculate session duration based on messages within the date range
      let duration = 0;
      if (messages.length >= 2) {
        const firstMessage = new Date(messages[0].timestamp);
        const lastMessage = new Date(messages[messages.length - 1].timestamp);
        duration = Math.max(0, (lastMessage - firstMessage) / 1000); // Duration in seconds

        // Only count sessions with positive duration
        if (duration > 0) {
          totalDurationSeconds += duration;
          sessionsWithDuration++;
        }
      }

      return { session_id: sessionId, messages, duration };
    })
  );

  // Calculate average duration in seconds
  const avgDurationSeconds = sessionsWithDuration > 0 ? Math.round(totalDurationSeconds / sessionsWithDuration) : 0;

  return { chatbot, sessions, avgDurationSeconds };
}

async function getAnalytics(companyId, dateRange = null, startDate = null, endDate = null) {
  const chatbot = await getChatbotByCompany(companyId);
  if (!chatbot) return { notFound: true };

  // Calculate date filter
  let dateFilter = {};
  if (dateRange && dateRange !== "all") {
    const now = new Date();
    let cutoffDate = new Date();

    if (dateRange === "custom" && startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = { timestamp: { $gte: start, $lte: end } };
    } else {
      switch (dateRange) {
        case "7days":
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case "30days":
          cutoffDate.setDate(now.getDate() - 30);
          break;
        case "90days":
          cutoffDate.setDate(now.getDate() - 90);
          break;
        default:
          cutoffDate.setDate(now.getDate() - 7);
      }
      dateFilter = { timestamp: { $gte: cutoffDate } };
    }
  }

  // Aggregation pipeline for efficient analytics
  const [messagesByDate, sessionStats, totalMessages] = await Promise.all([
    // Get messages grouped by date for chart
    Message.aggregate([
      {
        $match: {
          chatbot_id: chatbot._id,
          ...dateFilter
        }
      },
      {
        $project: {
          date: {
            $dateToString: { format: "%Y-%m-%d", date: "$timestamp" }
          }
        }
      },
      {
        $group: {
          _id: "$date",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]),

    // Get session count and average duration using aggregation
    Message.aggregate([
      {
        $match: {
          chatbot_id: chatbot._id,
          ...dateFilter
        }
      },
      {
        $group: {
          _id: "$session_id",
          firstMessage: { $min: "$timestamp" },
          lastMessage: { $max: "$timestamp" },
          messageCount: { $sum: 1 }
        }
      },
      {
        $project: {
          duration: {
            $cond: {
              if: { $gte: ["$messageCount", 2] },
              then: { $divide: [{ $subtract: ["$lastMessage", "$firstMessage"] }, 1000] },
              else: 0
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          totalDuration: { $sum: "$duration" },
          sessionsWithDuration: {
            $sum: { $cond: [{ $gt: ["$duration", 0] }, 1, 0] }
          }
        }
      }
    ]),

    // Get total message count
    Message.countDocuments({
      chatbot_id: chatbot._id,
      ...dateFilter
    })
  ]);

  // Process results
  const chartData = messagesByDate.map(item => ({
    date: item._id,
    count: item.count
  }));

  const stats = sessionStats[0] || { totalSessions: 0, totalDuration: 0, sessionsWithDuration: 0 };
  const avgDurationSeconds = stats.sessionsWithDuration > 0
    ? Math.round(stats.totalDuration / stats.sessionsWithDuration)
    : 0;
  const avgMessagesPerChat = stats.totalSessions > 0
    ? Math.round(totalMessages / stats.totalSessions)
    : 0;

  return {
    chartData,
    totalMessages,
    totalSessions: stats.totalSessions,
    avgDurationSeconds,
    avgMessagesPerChat
  };
}

async function getUniqueEmailsPhones(companyId) {
  const chatbot = await getChatbotByCompany(companyId);
  if (!chatbot) return { notFound: true };
  const subscription = await Subscription.findOne({ chatbot_id: chatbot._id }).sort({ end_date: -1 });
  const window = deriveWindowFromSubscription(subscription);
  const { emails, phoneNumbers } = await getVerifiedEmailsAndPhones(chatbot._id, window);
  return { chatbot, emails: emails || [], phoneNumbers: phoneNumbers || [] };
}

async function buildOverallReport(companyId) {
  const marked = require('marked');
  const chatbot = await getChatbotByCompany(companyId);
  if (!chatbot) return { notFound: true };
  const company = await Company.findById(chatbot.company_id);
  const subscription = await Subscription.findOne({ chatbot_id: chatbot._id }).sort({ end_date: -1 }).populate("plan_id");
  const window = deriveWindowFromSubscription(subscription);
  const msgMatch = { chatbot_id: chatbot._id, ...(window ? makeDateFilter(window, "timestamp") : {}) };

  // Get unique sessions count
  const uniqueSessions = await Message.distinct("session_id", msgMatch);
  const total_sessions = uniqueSessions.length;

  const [total_messages, unique_users, recentMessages] = await Promise.all([
    Message.countDocuments(msgMatch),
    countUniqueVerifiedUsers(chatbot._id, window),
    Message.find(msgMatch).sort({ timestamp: -1 }).limit(50),
  ]);

  // Process markdown for each message
  const processedMessages = recentMessages.map(msg => ({
    ...msg.toObject(),
    contentHtml: marked.parse(msg.content || '', { breaks: true, gfm: true })
  }));

  const now = new Date();
  const expiry = new Date(subscription.end_date);
  const daysRemaining = Math.max(0, Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)));
  const duration_days = Math.ceil((subscription.end_date - subscription.start_date) / (1000 * 60 * 60 * 24));

  const data = {
    title: "AI Agent Analytics Report",
    generatedOn: new Date().toLocaleString(),
    company: { name: chatbot.company_name, email: company?.email || "", domain: chatbot.company_url },
    plan: { name: subscription.plan_id.name, duration_days, days_remaining: daysRemaining, max_users: subscription.plan_id.max_users },
    usage: { total_messages, unique_users, total_sessions },
    messages: processedMessages,
  };

  const pdfBuffer = await generatePDFBuffer(data);
  return { pdfBuffer };
}

async function buildChatHistoryPDFByEmail(companyId, email) {
  const marked = require('marked');
  const chatbot = await getChatbotByCompany(companyId);
  if (!chatbot) return { notFound: true };
  const company = await Company.findById(chatbot.company_id);
  const messages = await Message.find({ chatbot_id: chatbot._id, email }).sort({ timestamp: 1 });
  if (!messages.length) return { notFound: true };

  // Process markdown for each message
  const processedMessages = messages.map(msg => ({
    ...msg.toObject(),
    contentHtml: marked.parse(msg.content || '', { breaks: true, gfm: true })
  }));

  const pdfData = {
    title: `Chat History for ${email}`,
    generatedOn: new Date().toLocaleString(),
    company: { name: chatbot.company_name, email: company?.email || "", domain: chatbot.company_url },
    user_email: email,
    messages: processedMessages,
  };
  const pdfBuffer = await generatePDFBuffer(pdfData, "chatHistoryTemplate.ejs");
  return { pdfBuffer };
}

async function buildChatHistoryPDFByPhone(companyId, phone) {
  const marked = require('marked');
  const chatbot = await getChatbotByCompany(companyId);
  if (!chatbot) return { notFound: true };
  const company = await Company.findById(chatbot.company_id);
  const messages = await Message.find({ chatbot_id: chatbot._id, phone }).sort({ timestamp: 1 });
  if (!messages.length) return { notFound: true };

  // Process markdown for each message
  const processedMessages = messages.map(msg => ({
    ...msg.toObject(),
    contentHtml: marked.parse(msg.content || '', { breaks: true, gfm: true })
  }));

  const pdfData = {
    title: `Chat History for ${phone}`,
    generatedOn: new Date().toLocaleString(),
    company: { name: chatbot.company_name, email: company?.email || "", domain: chatbot.company_url },
    user_phone: phone,
    messages: processedMessages,
  };
  const pdfBuffer = await generatePDFBuffer(pdfData, "chatHistoryTemplate.ejs");
  return { pdfBuffer };
}

async function buildChatHistoryPDFBySession(companyId, session_id) {
  const marked = require('marked');
  const chatbot = await getChatbotByCompany(companyId);
  if (!chatbot) return { notFound: true };
  const company = await Company.findById(chatbot.company_id);
  const messages = await Message.find({ chatbot_id: chatbot._id, session_id }).sort({ timestamp: 1 });
  if (!messages.length) return { notFound: true };

  // Process markdown for each message
  const processedMessages = messages.map(msg => ({
    ...msg.toObject(),
    contentHtml: marked.parse(msg.content || '', { breaks: true, gfm: true })
  }));

  const pdfData = {
    title: `Chat History for Guest Session`,
    generatedOn: new Date().toLocaleString(),
    company: { name: chatbot.company_name, email: company?.email || "", domain: chatbot.company_url },
    user_session: session_id,
    messages: processedMessages,
  };
  const pdfBuffer = await generatePDFBuffer(pdfData, "chatHistoryTemplate.ejs");
  return { pdfBuffer };
}

async function exportVerifiedEmailsPhonesCSV(companyId) {
  const chatbot = await getChatbotByCompany(companyId);
  if (!chatbot) return { notFound: true };
  const subscription = await Subscription.findOne({ chatbot_id: chatbot._id }).sort({ end_date: -1 });
  const window = deriveWindowFromSubscription(subscription);
  const { emails, phoneNumbers } = await getVerifiedEmailsAndPhones(chatbot._id, window);
  const combinedData = [
    ...(emails || []).map((email) => ({ type: "email", contact: email })),
    ...(phoneNumbers || []).map((phone) => ({ type: "phone", contact: phone })),
  ];
  if (combinedData.length === 0) return { notFound: true };
  const csv = json2csv(combinedData, { fields: ["type", "contact"] });
  return { csv };
}

async function getUniqueEmailsPhonesFromMessages(companyId) {
  const chatbot = await getChatbotByCompany(companyId);
  if (!chatbot) return { notFound: true };
  const emailsAgg = await Message.aggregate([
    { $match: { chatbot_id: chatbot._id, email: { $exists: true, $ne: null, $ne: "" } } },
    { $group: { _id: { $toLower: "$email" } } },
    { $project: { _id: 0, email: "$_id" } },
  ]);
  const emails = emailsAgg.map((e) => e.email);
  const phoneNumbers = await Message.distinct("phone", { chatbot_id: chatbot._id, phone: { $exists: true, $ne: null, $ne: "" } });
  return { emails, phoneNumbers };
}

async function exportAllEmailsPhonesFromMessagesCSV(companyId) {
  const chatbot = await getChatbotByCompany(companyId);
  if (!chatbot) return { notFound: true };
  const messages = await Message.find({ chatbot_id: chatbot._id, $or: [{ email: { $exists: true, $ne: null, $ne: "" } }, { phone: { $exists: true, $ne: null, $ne: "" } }] }).select("email phone");
  const combinedData = [];
  const emailSet = new Set();
  const phoneSet = new Set();
  messages.forEach((msg) => {
    if (msg.email && msg.email.trim()) {
      const normalizedEmail = msg.email.toLowerCase().trim();
      if (!emailSet.has(normalizedEmail)) {
        emailSet.add(normalizedEmail);
        combinedData.push({ type: "email", contact: normalizedEmail });
      }
    }
    if (msg.phone && msg.phone.trim()) {
      const normalizedPhone = msg.phone.trim();
      if (!phoneSet.has(normalizedPhone)) {
        phoneSet.add(normalizedPhone);
        combinedData.push({ type: "phone", contact: normalizedPhone });
      }
    }
  });
  if (combinedData.length === 0) return { notFound: true };
  const csv = json2csv(combinedData, { fields: ["type", "contact"] });
  return { csv };
}

async function getTopUsers(companyId, dateRange = null, startDate = null, endDate = null) {
  const chatbot = await getChatbotByCompany(companyId);
  if (!chatbot) return { notFound: true };

  // Calculate date filter
  let dateFilter = {};
  if (dateRange && dateRange !== "all") {
    const now = new Date();
    let cutoffDate = new Date();

    if (dateRange === "custom" && startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = { timestamp: { $gte: start, $lte: end } };
    } else {
      switch (dateRange) {
        case "7days":
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case "30days":
          cutoffDate.setDate(now.getDate() - 30);
          break;
        case "90days":
          cutoffDate.setDate(now.getDate() - 90);
          break;
        default:
          cutoffDate.setDate(now.getDate() - 7);
      }
      dateFilter = { timestamp: { $gte: cutoffDate } };
    }
  }

  // First, get all session IDs and their first message timestamp to calculate guest numbers
  const allSessions = await Message.aggregate([
    {
      $match: {
        chatbot_id: chatbot._id
      }
    },
    {
      $group: {
        _id: "$session_id",
        firstMessage: { $min: "$timestamp" },
        phone: { $first: "$phone" },
        email: { $first: "$email" },
        is_guest: { $first: "$is_guest" }
      }
    }
  ]);

  // Filter guest sessions and sort by timestamp to assign guest numbers
  const guestSessions = allSessions
    .filter(s => !s.phone && !s.email)
    .sort((a, b) => new Date(a.firstMessage) - new Date(b.firstMessage));

  // Create a map of session_id to guest_number
  const guestNumberMap = {};
  guestSessions.forEach((session, index) => {
    guestNumberMap[session._id] = index + 1;
  });

  // Aggregate to get top users by message count
  const topUsers = await Message.aggregate([
    {
      $match: {
        chatbot_id: chatbot._id,
        sender: "user", // Only count user messages, not bot messages
        ...dateFilter
      }
    },
    {
      $group: {
        _id: {
          session_id: "$session_id",
          identifier: {
            $cond: [
              { $and: [{ $ifNull: ["$phone", false] }, { $ne: ["$phone", ""] }] },
              { $concat: ["phone:", "$phone"] },
              {
                $cond: [
                  { $and: [{ $ifNull: ["$email", false] }, { $ne: ["$email", ""] }] },
                  { $concat: ["email:", "$email"] },
                  { $concat: ["guest:", "$session_id"] }
                ]
              }
            ]
          },
          phone: "$phone",
          email: "$email",
          is_guest: "$is_guest"
        },
        messageCount: { $sum: 1 },
        lastActive: { $max: "$timestamp" }
      }
    },
    {
      $project: {
        session_id: "$_id.session_id",
        phone: "$_id.phone",
        email: "$_id.email",
        is_guest: "$_id.is_guest",
        identifier: "$_id.identifier",
        messageCount: 1,
        lastActive: 1
      }
    },
    {
      $sort: { messageCount: -1 }
    },
    {
      $limit: 10
    }
  ]);

  // Format the response with proper guest numbers
  const formattedUsers = topUsers.map(user => {
    let displayIdentifier = "";
    let identifierType = "";

    if (user.phone && user.phone.trim() !== "") {
      displayIdentifier = user.phone;
      identifierType = "phone";
    } else if (user.email && user.email.trim() !== "") {
      displayIdentifier = user.email;
      identifierType = "email";
    } else {
      // Use the guest number from the map
      const guestNumber = guestNumberMap[user.session_id];
      displayIdentifier = guestNumber ? `Guest ${guestNumber}` : 'Guest';
      identifierType = "guest";
    }

    return {
      session_id: user.session_id,
      identifier: displayIdentifier,
      identifierType,
      phone: user.phone || null,
      email: user.email || null,
      messageCount: user.messageCount,
      lastActive: user.lastActive,
      is_guest: user.is_guest || false
    };
  });

  return { topUsers: formattedUsers };
}

async function getUserChatHistory(companyId, session_id, phone = null, email = null) {
  const chatbot = await getChatbotByCompany(companyId);
  if (!chatbot) return { notFound: true };

  let messages = [];

  if (session_id) {
    // Direct session query - get all messages from this session
    messages = await Message.find({
      chatbot_id: chatbot._id,
      session_id: session_id
    }).sort({ timestamp: 1 });
  } else if (phone) {
    // Phone query - find all session_ids that have this phone, then get ALL messages from those sessions
    const sessionsWithPhone = await Message.distinct("session_id", {
      chatbot_id: chatbot._id,
      phone: phone
    });

    if (sessionsWithPhone.length > 0) {
      messages = await Message.find({
        chatbot_id: chatbot._id,
        session_id: { $in: sessionsWithPhone }
      }).sort({ timestamp: 1 });
    }
  } else if (email) {
    // Email query - find all session_ids that have this email, then get ALL messages from those sessions
    const sessionsWithEmail = await Message.distinct("session_id", {
      chatbot_id: chatbot._id,
      email: email
    });

    if (sessionsWithEmail.length > 0) {
      messages = await Message.find({
        chatbot_id: chatbot._id,
        session_id: { $in: sessionsWithEmail }
      }).sort({ timestamp: 1 });
    }
  } else {
    return { notFound: true, message: "No identifier provided" };
  }

  if (!messages.length) {
    return { notFound: true, message: "No messages found" };
  }

  // Calculate stats
  const userMessages = messages.filter(m => m.sender === "user");
  const botMessages = messages.filter(m => m.sender === "bot");
  const firstMessage = messages[0];
  const lastMessage = messages[messages.length - 1];
  const duration = (new Date(lastMessage.timestamp) - new Date(firstMessage.timestamp)) / 1000; // in seconds

  return {
    messages,
    stats: {
      totalMessages: messages.length,
      userMessages: userMessages.length,
      botMessages: botMessages.length,
      firstMessage: firstMessage.timestamp,
      lastMessage: lastMessage.timestamp,
      duration,
      session_id: session_id || messages[0].session_id,
      phone: phone || messages[0].phone || null,
      email: email || messages[0].email || null
    }
  };
}

async function getVerifiedPhoneLeads(companyId, params = {}) {
  const chatbot = await getChatbotByCompany(companyId);
  if (!chatbot) return { notFound: true };

  const { page = 1, limit = 20, searchTerm = '', dateRange = null, startDate = null, endDate = null } = params;
  const skip = (page - 1) * limit;

  // Build query for PhoneUser
  const query = {
    chatbotId: String(chatbot._id),
    verified: true,
    phone: { $exists: true, $ne: null, $ne: "" }
  };

  // Add search filter
  if (searchTerm) {
    query.phone = { $regex: searchTerm, $options: 'i' };
  }

  // Add date range filter
  if (dateRange && dateRange !== "all") {
    const now = new Date();
    let cutoffDate = new Date();

    if (dateRange === "custom" && startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    } else {
      switch (dateRange) {
        case "7days":
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case "30days":
          cutoffDate.setDate(now.getDate() - 30);
          break;
        case "90days":
          cutoffDate.setDate(now.getDate() - 90);
          break;
        default:
          cutoffDate.setDate(now.getDate() - 30);
      }
      query.createdAt = { $gte: cutoffDate };
    }
  }

  // Fetch verified phone numbers from PhoneUser model
  const PhoneUser = require("../models/PhoneUser");
  const [phoneLeads, total] = await Promise.all([
    PhoneUser.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('phone verified createdAt updatedAt'),
    PhoneUser.countDocuments(query)
  ]);

  // Also get verified users from VerifiedUser model for phone numbers
  const verifiedQuery = {
    chatbot_id: chatbot._id,
    phone: { $exists: true, $ne: null, $ne: "" }
  };

  if (searchTerm) {
    verifiedQuery.phone = { $regex: searchTerm, $options: 'i' };
  }

  if (dateRange && dateRange !== "all") {
    const now = new Date();
    let cutoffDate = new Date();

    if (dateRange === "custom" && startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      verifiedQuery.verified_at = { $gte: start, $lte: end };
    } else {
      switch (dateRange) {
        case "7days":
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case "30days":
          cutoffDate.setDate(now.getDate() - 30);
          break;
        case "90days":
          cutoffDate.setDate(now.getDate() - 90);
          break;
        default:
          cutoffDate.setDate(now.getDate() - 30);
      }
      verifiedQuery.verified_at = { $gte: cutoffDate };
    }
  }

  const [verifiedLeads, verifiedTotal] = await Promise.all([
    VerifiedUser.find(verifiedQuery)
      .sort({ verified_at: -1 })
      .skip(skip)
      .limit(limit)
      .select('phone verified_at provider session_id'),
    VerifiedUser.countDocuments(verifiedQuery)
  ]);

  // Also get phone numbers from Message collection
  const Message = require("../models/Message");
  const messageQuery = {
    chatbot_id: chatbot._id,
    phone: { $exists: true, $ne: null, $ne: "" }
  };

  if (searchTerm) {
    messageQuery.phone = { $regex: searchTerm, $options: 'i' };
  }

  if (dateRange && dateRange !== "all") {
    const now = new Date();
    let cutoffDate = new Date();

    if (dateRange === "custom" && startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      messageQuery.timestamp = { $gte: start, $lte: end };
    } else {
      switch (dateRange) {
        case "7days":
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case "30days":
          cutoffDate.setDate(now.getDate() - 30);
          break;
        case "90days":
          cutoffDate.setDate(now.getDate() - 90);
          break;
        default:
          cutoffDate.setDate(now.getDate() - 30);
      }
      messageQuery.timestamp = { $gte: cutoffDate };
    }
  }

  // Get unique phone numbers from messages
  const uniquePhones = await Message.distinct('phone', messageQuery);

  // For each unique phone, get the first message
  const messageLeads = [];
  for (const phone of uniquePhones) {
    const firstMessage = await Message.findOne({
      chatbot_id: chatbot._id,
      phone: phone
    }).sort({ timestamp: 1 });

    if (firstMessage) {
      messageLeads.push({
        phone: phone,
        timestamp: firstMessage.timestamp,
        session_id: firstMessage.session_id,
        _id: firstMessage._id
      });
    }
  }

  // Combine and deduplicate leads
  const phoneMap = new Map();

  // Add PhoneUser leads
  phoneLeads.forEach(lead => {
    phoneMap.set(lead.phone, {
      id: String(lead._id),
      phone: lead.phone,
      verified: lead.verified,
      verifiedAt: lead.createdAt,
      source: 'phone_verification'
    });
  });

  // Add VerifiedUser leads (these take precedence if duplicates)
  verifiedLeads.forEach(lead => {
    if (!phoneMap.has(lead.phone) || new Date(lead.verified_at) > new Date(phoneMap.get(lead.phone).verifiedAt)) {
      phoneMap.set(lead.phone, {
        id: String(lead._id),
        phone: lead.phone,
        verified: true,
        verifiedAt: lead.verified_at,
        provider: lead.provider,
        sessionId: lead.session_id,
        source: 'verified_user'
      });
    }
  });

  // Add Message leads (only if not already present from PhoneUser or VerifiedUser)
  messageLeads.forEach(lead => {
    if (!phoneMap.has(lead.phone)) {
      phoneMap.set(lead.phone, {
        id: String(lead._id),
        phone: lead.phone,
        verified: true,
        verifiedAt: lead.timestamp,
        source: 'message_history',
        sessionId: lead.session_id
      });
    }
  });

  // Get all leads, filter out null/empty phone numbers, then sort and paginate
  const allLeads = Array.from(phoneMap.values())
    .filter(lead => lead.phone && lead.phone.trim() !== '') // Filter out null/empty phones
    .sort((a, b) => new Date(b.verifiedAt) - new Date(a.verifiedAt));

  const totalValidLeads = allLeads.length;
  const leads = allLeads.slice((page - 1) * limit, page * limit);

  return {
    chatbot,
    leads,
    total: totalValidLeads,
    page,
    totalPages: Math.ceil(totalValidLeads / limit)
  };
}

/**
 * Get collected leads - users who shared name/phone through chat
 */
async function getCollectedLeads(companyId, params = {}) {
  const chatbot = await getChatbotByCompany(companyId);
  if (!chatbot) return { notFound: true };

  const { page = 1, limit = 20, searchTerm = '', dateRange = null, startDate = null, endDate = null } = params;

  // Build base query - just filter by chatbot
  const query = {
    chatbot_id: chatbot._id
  };

  // We'll filter for name/phone in the aggregation pipeline instead

  // Add date range filter
  if (dateRange && dateRange !== "all") {
    const now = new Date();
    let cutoffDate = new Date();

    if (dateRange === "custom" && startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.timestamp = { $gte: start, $lte: end };
    } else {
      switch (dateRange) {
        case "7days":
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case "30days":
          cutoffDate.setDate(now.getDate() - 30);
          break;
        case "90days":
          cutoffDate.setDate(now.getDate() - 90);
          break;
        default:
          cutoffDate.setDate(now.getDate() - 30);
      }
      query.timestamp = { $gte: cutoffDate };
    }
  }

  // Two-stage grouping:
  // 1. First group by session_id to get name/phone per session
  // 2. Then group by phone (if exists) OR by session_id (if no phone)
  const aggregation = [
    { $match: query },
    { $sort: { timestamp: 1 } },

    // Stage 1: Group by session_id to get latest name and phone per session
    {
      $group: {
        _id: "$session_id",
        firstTimestamp: { $first: "$timestamp" },
        messageCount: { $sum: 1 },
        allNames: { $push: "$name" },
        allPhones: { $push: "$phone" }
      }
    },

    // Stage 2: Extract the latest non-null name and phone from each session
    {
      $addFields: {
        latestName: {
          $arrayElemAt: [
            {
              $filter: {
                input: { $reverseArray: "$allNames" },
                as: "n",
                cond: { $and: [{ $ne: ["$$n", null] }, { $ne: ["$$n", ""] }] }
              }
            },
            0
          ]
        },
        latestPhone: {
          $arrayElemAt: [
            {
              $filter: {
                input: { $reverseArray: "$allPhones" },
                as: "p",
                cond: { $and: [{ $ne: ["$$p", null] }, { $ne: ["$$p", ""] }] }
              }
            },
            0
          ]
        }
      }
    },

    // Stage 3: Create grouping key - use phone if exists, otherwise session_id
    {
      $addFields: {
        groupKey: {
          $cond: {
            if: {
              $and: [
                { $ne: ["$latestPhone", null] },
                { $ne: ["$latestPhone", ""] },
                { $ne: [{ $type: "$latestPhone" }, "missing"] }
              ]
            },
            then: { $concat: ["phone:", "$latestPhone"] },
            else: { $concat: ["session:", "$_id"] }
          }
        }
      }
    },

    // Stage 4: Group by the groupKey (phone or session)
    {
      $group: {
        _id: "$groupKey",
        session_id: { $first: "$_id" },
        firstTimestamp: { $min: "$firstTimestamp" },
        totalMessages: { $sum: "$messageCount" },
        finalName: { $last: "$latestName" },
        finalPhone: { $last: "$latestPhone" }
      }
    },

    // Stage 5: Project final structure
    {
      $project: {
        session_id: 1,
        name: "$finalName",
        phone: "$finalPhone",
        timestamp: "$firstTimestamp",
        messageCount: "$totalMessages"
      }
    },

    // Filter: must have at least name OR phone
    {
      $match: {
        $or: [
          {
            $and: [
              { name: { $exists: true } },
              { name: { $ne: null } },
              { name: { $ne: "" } },
              { name: { $type: "string" } }
            ]
          },
          {
            $and: [
              { phone: { $exists: true } },
              { phone: { $ne: null } },
              { phone: { $ne: "" } },
              { phone: { $type: "string" } }
            ]
          }
        ]
      }
    }
  ];

  // Add search filter if provided
  if (searchTerm) {
    aggregation.push({
      $match: {
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { phone: { $regex: searchTerm, $options: 'i' } }
        ]
      }
    });
  }

  // Final sort
  aggregation.push({ $sort: { timestamp: -1 } });

  const [leads, totalResult] = await Promise.all([
    Message.aggregate([
      ...aggregation,
      { $skip: (page - 1) * limit },
      { $limit: limit }
    ]),
    Message.aggregate([
      ...aggregation,
      { $count: "total" }
    ])
  ]);

  const total = totalResult[0]?.total || 0;

  // Format leads for frontend
  const formattedLeads = leads.map(lead => ({
      id: String(lead._id),
      session_id: lead.session_id,
      name: lead.name || "Anonymous",
      phone: lead.phone || "N/A",
      collectedAt: lead.timestamp,
      messageCount: lead.messageCount,
      hasName: !!lead.name,
      hasPhone: !!lead.phone
    }));

  return {
    leads: formattedLeads,
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
}

module.exports = {
  getChatbotByCompany,
  getUserPlanSummary,
  getUsage,
  getMessages,
  getSessions,
  getAnalytics,
  getUniqueEmailsPhones,
  buildOverallReport,
  buildChatHistoryPDFByEmail,
  buildChatHistoryPDFByPhone,
  buildChatHistoryPDFBySession,
  exportVerifiedEmailsPhonesCSV,
  getUniqueEmailsPhonesFromMessages,
  exportAllEmailsPhonesFromMessagesCSV,
  getVerifiedPhoneLeads,
  getTopUsers,
  getUserChatHistory,
  getCollectedLeads,
};
