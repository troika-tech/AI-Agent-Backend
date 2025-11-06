// services/reportService.js
// Thin wrappers around userService for generating reports/exports
const userService = require("./userService");

async function generateOverallReportPDF(companyId) {
  const { pdfBuffer, notFound } = await userService.buildOverallReport(companyId);
  return { pdfBuffer, notFound };
}

async function generateChatHistoryPDFByEmail(companyId, email) {
  return userService.buildChatHistoryPDFByEmail(companyId, email);
}

async function generateChatHistoryPDFByPhone(companyId, phone) {
  return userService.buildChatHistoryPDFByPhone(companyId, phone);
}

async function generateChatHistoryPDFBySession(companyId, session_id) {
  return userService.buildChatHistoryPDFBySession(companyId, session_id);
}

async function exportVerifiedContactsCSV(companyId) {
  return userService.exportVerifiedEmailsPhonesCSV(companyId);
}

async function exportAllContactsFromMessagesCSV(companyId) {
  return userService.exportAllEmailsPhonesFromMessagesCSV(companyId);
}

module.exports = {
  generateOverallReportPDF,
  generateChatHistoryPDFByEmail,
  generateChatHistoryPDFByPhone,
  generateChatHistoryPDFBySession,
  exportVerifiedContactsCSV,
  exportAllContactsFromMessagesCSV,
};
