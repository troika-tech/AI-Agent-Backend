// controllers/user/dataController.js
const { sendSuccessResponse } = require("../../utils/responseFormatter");
const ApiError = require("../../utils/ApiError");
const { catchAsync } = require("../../middleware/errorHandler");
const userService = require("../../services/userService");
const reportService = require("../../services/reportService");

exports.getUserUsage = catchAsync(async (req, res) => {
  console.log("🚀 [getUserUsage] Endpoint called for user:", req.user.id);
  const result = await userService.getUsage(req.user.id);

  console.log("📦 [getUserUsage] Service result:", result);

  if (result.notFound) {
    console.log("❌ [getUserUsage] Chatbot not found");
    throw ApiError.notFound("Chatbot not found");
  }

  const { total_messages, unique_users, last_activity } = result.usage || {};

  console.log("✅ [getUserUsage] Sending response:");
  console.log("  - total_messages:", total_messages);
  console.log("  - unique_users:", unique_users);
  console.log("  - last_activity:", last_activity);

  return sendSuccessResponse(res, { total_messages, unique_users, last_activity });
});

exports.getUserMessages = catchAsync(async (req, res) => {
  const { page, limit, email, phone, is_guest, session_id, dateRange, startDate, endDate } = req.query;
  const result = await userService.getMessages(req.user.id, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    email,
    phone,
    is_guest,
    session_id,
    dateRange,
    startDate,
    endDate,
  });
  if (result.notFound) throw ApiError.notFound("Chatbot not found");
  const messages = (result.messages || []).map((m) => ({
    id: String(m._id),
    content: m.content,
    sender: m.sender,
    timestamp: m.timestamp,
    session_id: m.session_id,
    email: m.email,
    phone: m.phone,
    token_count: m.token_count ?? 0,
    is_guest: m.is_guest ?? false,
  }));
  return sendSuccessResponse(res, {
    messages,
    totalPages: result.totalPages,
    currentPage: result.page,
    totalMessages: result.total,
  });
});

exports.getUserSessions = catchAsync(async (req, res) => {
  const { dateRange, startDate, endDate } = req.query;
  const result = await userService.getSessions(req.user.id, dateRange, startDate, endDate);
  if (result.notFound) throw ApiError.notFound("Chatbot not found");
  return sendSuccessResponse(res, { sessions: result.sessions, avgDurationSeconds: result.avgDurationSeconds });
});

exports.getUserAnalytics = catchAsync(async (req, res) => {
  const { dateRange, startDate, endDate } = req.query;
  const result = await userService.getAnalytics(req.user.id, dateRange, startDate, endDate);
  if (result.notFound) throw ApiError.notFound("Chatbot not found");
  return sendSuccessResponse(res, result);
});

exports.getUniqueEmailsAndPhones = catchAsync(async (req, res) => {
  const result = await userService.getUniqueEmailsPhones(req.user.id);
  if (result.notFound) throw ApiError.notFound("Chatbot not found");
  return sendSuccessResponse(res, { emails: result.emails, phoneNumbers: result.phoneNumbers });
});

exports.downloadUserReport = catchAsync(async (req, res) => {
  const { pdfBuffer, notFound } = await reportService.generateOverallReportPDF(req.user.id);
  if (notFound) throw ApiError.notFound("Chatbot or subscription not found");
  res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="agent_report.pdf"` });
  res.send(pdfBuffer);
});

exports.downloadUserChatByEmail = catchAsync(async (req, res) => {
  const { email } = req.params;
  const { pdfBuffer, notFound } = await reportService.generateChatHistoryPDFByEmail(req.user.id, email);
  if (notFound) throw ApiError.notFound("No chat history found for this email.");
  res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="chat_${email.replace(/[@.]/g, "_")}.pdf"` });
  res.send(pdfBuffer);
});

exports.downloadUserChatByPhone = catchAsync(async (req, res) => {
  const { phone } = req.params;
  const { pdfBuffer, notFound } = await reportService.generateChatHistoryPDFByPhone(req.user.id, phone);
  if (notFound) throw ApiError.notFound("No chat history found for this phone number.");
  res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="chat_${phone.replace(/[^\d+]/g, "_")}.pdf"` });
  res.send(pdfBuffer);
});

exports.downloadUserChatBySession = catchAsync(async (req, res) => {
  const { session_id } = req.params;
  const { pdfBuffer, notFound } = await reportService.generateChatHistoryPDFBySession(req.user.id, session_id);
  if (notFound) throw ApiError.notFound("No chat history found for this session.");
  const safeSessionId = session_id.replace(/[^a-zA-Z0-9-]/g, "_");
  res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="chat_guest_session_${safeSessionId}.pdf"` });
  res.send(pdfBuffer);
});

exports.downloadEmailsAndPhoneNumbersCSV = catchAsync(async (req, res) => {
  const { csv, notFound } = await reportService.exportVerifiedContactsCSV(req.user.id);
  if (notFound) throw ApiError.notFound("No verified emails or phone numbers found for the specified period");
  res.header("Content-Type", "text/csv");
  res.attachment("emails_and_phone_numbers.csv");
  res.send(csv);
});

exports.getUniqueEmailsAndPhonesFromMessages = catchAsync(async (req, res) => {
  const { emails, phoneNumbers } = await userService.getUniqueEmailsPhonesFromMessages(req.user.id);
  return sendSuccessResponse(res, { emails, phoneNumbers });
});

exports.downloadAllEmailsAndPhoneNumbersFromMessages = catchAsync(async (req, res) => {
  const { csv, notFound } = await reportService.exportAllContactsFromMessagesCSV(req.user.id);
  if (notFound) throw ApiError.notFound("No emails or phone numbers found in messages");
  res.header("Content-Type", "text/csv");
  res.attachment("all_emails_and_phone_numbers.csv");
  res.send(csv);
});

exports.getVerifiedPhoneLeads = catchAsync(async (req, res) => {
  const { page, limit, searchTerm, dateRange, startDate, endDate } = req.query;
  const result = await userService.getVerifiedPhoneLeads(req.user.id, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    searchTerm,
    dateRange,
    startDate,
    endDate,
  });
  if (result.notFound) throw ApiError.notFound("Chatbot not found");

  return sendSuccessResponse(res, {
    leads: result.leads,
    total: result.total,
    currentPage: result.page,
    totalPages: result.totalPages,
  });
});

exports.getTopUsers = catchAsync(async (req, res) => {
  const { dateRange, startDate, endDate } = req.query;
  const result = await userService.getTopUsers(req.user.id, dateRange, startDate, endDate);
  if (result.notFound) throw ApiError.notFound("Chatbot not found");
  return sendSuccessResponse(res, { topUsers: result.topUsers });
});

exports.getUserChatHistory = catchAsync(async (req, res) => {
  const { session_id, phone, email } = req.query;
  const result = await userService.getUserChatHistory(req.user.id, session_id, phone, email);
  if (result.notFound) throw ApiError.notFound(result.message || "Chat history not found");
  return sendSuccessResponse(res, result);
});

// Get collected leads (users who shared name/phone in chat)
exports.getCollectedLeads = catchAsync(async (req, res) => {
  const { page, limit, searchTerm, dateRange, startDate, endDate } = req.query;
  const result = await userService.getCollectedLeads(req.user.id, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    searchTerm,
    dateRange,
    startDate,
    endDate,
  });
  if (result.notFound) throw ApiError.notFound("Chatbot not found");

  return sendSuccessResponse(res, {
    leads: result.leads,
    total: result.total,
    currentPage: result.page,
    totalPages: result.totalPages,
  });
});
