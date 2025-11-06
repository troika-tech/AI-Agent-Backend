// controllers/user/accountController.js
const { sendSuccessResponse } = require("../../utils/responseFormatter");
const ApiError = require("../../utils/ApiError");
const { catchAsync } = require("../../middleware/errorHandler");
const userService = require("../../services/userService");
const authService = require("../../services/authService");

// POST /api/user/login
exports.loginUser = catchAsync(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw ApiError.badRequest("Email and password are required");
  const result = await authService.loginCompany({ email, password });
  if (result.unauthorized) throw ApiError.unauthorized("Invalid email or password");
  // Spec requires raw token/role/user shape inside data
  return sendSuccessResponse(res, {
    token: result.token,
    role: "user",
    user: { id: result.user.id, name: result.user.name, email: result.user.email },
  }, "Login successful");
});

exports.getUserCompany = catchAsync(async (req, res) => {
  const chatbot = await userService.getChatbotByCompany(req.user.id);
  if (!chatbot) throw ApiError.notFound("Chatbot not found");
  const Company = require("../../models/Company");
  const company = await Company.findById(chatbot.company_id);
  return sendSuccessResponse(res, {
    id: String(company?._id || chatbot.company_id),
    name: chatbot.company_name,
    chatbot_id: String(chatbot._id),
    created_at: company?.created_at || chatbot.created_at,
  });
});

exports.getUserPlan = catchAsync(async (req, res) => {
  const result = await userService.getUserPlanSummary(req.user.id);
  if (result.notFound) throw ApiError.notFound("Chatbot or subscription not found");
  return sendSuccessResponse(res, result.plan);
});
