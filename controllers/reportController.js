const Chatbot = require("../models/Chatbot");
const Message = require("../models/Message");
const VerifiedUser = require("../models/VerifiedUser");
const Subscription = require("../models/Subscription");
const Plan = require("../models/Plan");
const Company = require("../models/Company");
const puppeteer = require("puppeteer");
const { convertGuestMessagesToCSV, generateGuestAnalyticsHTML, generateOverallHTML } = require("../utils/reportHelpers");
const { buildDateRangeFilter } = require("../utils/queryBuilders");

exports.getOverallReport = async (req, res) => {
  try {
    const chatbots = await Chatbot.find().populate("company_id");
    const today = new Date();

    const enriched = await Promise.all(
      chatbots.map(async (bot) => {
        const company = bot.company_id;
        const subscription = await Subscription.findOne({
          chatbot_id: bot._id,
          status: "active",
        }).populate("plan_id");

        const totalUsers = await VerifiedUser.countDocuments({ chatbot_id: bot._id });
        const totalMessages = await Message.countDocuments({ chatbot_id: bot._id });
        const guestMessages = await Message.countDocuments({ chatbot_id: bot._id, is_guest: true });
        const authenticatedMessages = await Message.countDocuments({ chatbot_id: bot._id, is_guest: false });
        const recentMessages = await Message.find({ chatbot_id: bot._id })
          .sort({ timestamp: -1 })
          .limit(5)
          .select("sender content is_guest");

        let planName = subscription?.plan_name || subscription?.plan_id?.name || "N/A";
        let startDate = subscription?.start_date || null;
        let endDate = subscription?.end_date || null;
        let maxUsers = subscription?.plan_id?.max_users || 0;
        let remainingUsers = maxUsers - totalUsers;

        let daysRemaining = 0;
        let planDuration = 0;
        if (startDate && endDate) {
          const diffTime = Math.abs(endDate - startDate);
          planDuration = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));

          const remainingTime = endDate - today;
          daysRemaining = Math.max(0, Math.floor(remainingTime / (1000 * 60 * 60 * 24)));
        }

        return {
          companyName: company?.name || "N/A",
          domain: company?.url || "N/A",
          planName,
          planDuration,
          startDate: startDate?.toDateString() || "N/A",
          endDate: endDate?.toDateString() || "N/A",
          daysRemaining,
          totalUsers,
          remainingUsers,
          totalMessages,
          guestMessages,
          authenticatedMessages,
          guestPercentage: totalMessages > 0 ? ((guestMessages / totalMessages) * 100).toFixed(2) : 0,
          messageHistory: recentMessages,
        };
      })
    );

    if (req.query.download === "pdf") {
  const html = generateOverallHTML(enriched);

      const browser = await puppeteer.launch();
      const page = await browser.newPage();
      await page.setContent(html);
      const pdf = await page.pdf({ format: "A4" });
      await browser.close();

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="overall-chatbot-report.pdf"`,
      });
      return res.send(pdf);
    }

    res.json({ chatbots: enriched });
  } catch (error) {
    console.error("Overall report error:", error);
    res.status(500).json({ message: "Failed to generate report" });
  }
};

// 🎯 Guest Message Analytics
exports.getGuestMessageAnalytics = async (req, res) => {
  try {
    const { chatbotId, companyId, days = 7, download } = req.query;
    
    // Build filter
    const filter = {};
    if (chatbotId) filter.chatbot_id = chatbotId;
    if (companyId) {
      const chatbots = await Chatbot.find({ company_id: companyId }).select('_id');
      filter.chatbot_id = { $in: chatbots.map(c => c._id) };
    }
    
    // Date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    filter.timestamp = { $gte: startDate };
    
    // Get guest vs authenticated message analytics
    const [
      totalMessages,
      guestMessages,
      authenticatedMessages,
      guestSessions,
      guestConversionRate,
      dailyBreakdown,
      topGuestQueries,
    ] = await Promise.all([
      // Total messages
      Message.countDocuments(filter),
      
      // Guest messages
      Message.countDocuments({ ...filter, is_guest: true }),
      
      // Authenticated messages
      Message.countDocuments({ ...filter, is_guest: false }),
      
      // Unique guest sessions
      Message.distinct('session_id', { ...filter, is_guest: true }),
      
      // Guest to authenticated conversion rate
      Message.aggregate([
        { $match: { ...filter, is_guest: true } },
        { $group: { _id: '$session_id' } },
        { $lookup: {
          from: 'messages',
          let: { sessionId: '$_id' },
          pipeline: [
            { $match: { 
              $expr: { 
                $and: [
                  { $eq: ['$session_id', '$$sessionId'] },
                  { $eq: ['$is_guest', false] }
                ]
              }
            }},
            { $limit: 1 }
          ],
          as: 'converted'
        }},
        { $match: { 'converted.0': { $exists: true } } },
        { $count: 'converted' }
      ]),
      
      // Daily breakdown
      Message.aggregate([
        { $match: filter },
        { $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            is_guest: '$is_guest'
          },
          count: { $sum: 1 }
        }},
        { $group: {
          _id: '$_id.date',
          guest_messages: { 
            $sum: { $cond: ['$_id.is_guest', '$count', 0] }
          },
          authenticated_messages: { 
            $sum: { $cond: ['$_id.is_guest', 0, '$count'] }
          }
        }},
        { $sort: { _id: 1 } }
      ]),
      
      // Top guest queries
      Message.aggregate([
        { $match: { ...filter, is_guest: true, sender: 'user' } },
        { $group: {
          _id: '$content',
          count: { $sum: 1 },
          sessions: { $addToSet: '$session_id' }
        }},
        { $project: {
          query: '$_id',
          count: 1,
          unique_sessions: { $size: '$sessions' }
        }},
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      
    ]);
    
    const totalGuestSessions = guestSessions.length;
    const convertedSessions = guestConversionRate[0]?.converted || 0;
    
    const analytics = {
      summary: {
        total_messages: totalMessages,
        guest_messages: guestMessages,
        authenticated_messages: authenticatedMessages,
        guest_percentage: totalMessages > 0 ? ((guestMessages / totalMessages) * 100).toFixed(2) : 0,
        total_guest_sessions: totalGuestSessions,
        conversion_rate: totalGuestSessions > 0 ? ((convertedSessions / totalGuestSessions) * 100).toFixed(2) : 0,
      },
      daily_breakdown: dailyBreakdown,
      top_guest_queries: topGuestQueries,
      period: `${days} days`
    };
    
    // Generate PDF if requested
    if (download === 'pdf') {
  const html = generateGuestAnalyticsHTML(analytics);
      
      const browser = await puppeteer.launch();
      const page = await browser.newPage();
      await page.setContent(html);
      const pdf = await page.pdf({ format: "A4" });
      await browser.close();
      
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="guest-analytics-${new Date().toISOString().split('T')[0]}.pdf"`,
      });
      return res.send(pdf);
    }
    
    res.json({ success: true, data: analytics });
  } catch (error) {
    console.error("Guest analytics error:", error);
    res.status(500).json({ message: "Failed to generate guest analytics" });
  }
};

// 🎯 Get Guest Messages with Filtering
exports.getGuestMessages = async (req, res) => {
  try {
    const { 
      chatbotId, 
      companyId, 
      sessionId, 
      limit = 50, 
      offset = 0,
      startDate,
      endDate,
      includeContent = true
    } = req.query;
    
    // Build filter
    const filter = { is_guest: true };
    if (chatbotId) filter.chatbot_id = chatbotId;
    if (companyId) {
      const chatbots = await Chatbot.find({ company_id: companyId }).select('_id');
      filter.chatbot_id = { $in: chatbots.map(c => c._id) };
    }
    if (sessionId) filter.session_id = sessionId;
    
    Object.assign(filter, buildDateRangeFilter({ startDate, endDate }));
    
    // Select fields
    const selectFields = includeContent === 'false' 
      ? 'chatbot_id session_id sender timestamp is_guest' 
      : 'chatbot_id session_id sender content timestamp is_guest';
    
    const [messages, total] = await Promise.all([
      Message.find(filter)
        .select(selectFields)
        .populate('chatbot_id', 'name company_id')
        .sort({ timestamp: -1 })
        .skip(parseInt(offset))
        .limit(parseInt(limit)),
      Message.countDocuments(filter)
    ]);
    
    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (parseInt(offset) + parseInt(limit)) < total
        }
      }
    });
  } catch (error) {
    console.error("Get guest messages error:", error);
    res.status(500).json({ message: "Failed to fetch guest messages" });
  }
};

// 🎯 Export Guest Messages
exports.exportGuestMessages = async (req, res) => {
  try {
    const { 
      chatbotId, 
      companyId, 
      startDate, 
      endDate, 
      format = 'csv' 
    } = req.query;
    
    // Build filter
    const filter = { is_guest: true };
    if (chatbotId) filter.chatbot_id = chatbotId;
    if (companyId) {
      const chatbots = await Chatbot.find({ company_id: companyId }).select('_id');
      filter.chatbot_id = { $in: chatbots.map(c => c._id) };
    }
    
    Object.assign(filter, buildDateRangeFilter({ startDate, endDate }));
    
    const messages = await Message.find(filter)
      .populate('chatbot_id', 'name company_id')
      .populate('chatbot_id.company_id', 'name')
      .sort({ timestamp: -1 });
    
    if (format === 'csv') {
  const csvData = convertGuestMessagesToCSV(messages);
      const filename = `guest-messages-${new Date().toISOString().split('T')[0]}.csv`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-cache');
      res.send(csvData);
    } else {
      res.json({ success: true, data: messages });
    }
  } catch (error) {
    console.error("Export guest messages error:", error);
    res.status(500).json({ message: "Failed to export guest messages" });
  }
};

// 🎯 Helper function to convert guest messages to CSV
// Helper implementations moved to utils/reportHelpers.js
