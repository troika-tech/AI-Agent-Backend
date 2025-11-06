// controllers/admin/authController.js
const { catchAsync } = require("../../middleware/errorHandler");
const { sendSuccessResponse } = require("../../utils/responseFormatter");
const ApiError = require("../../utils/ApiError");
const adminService = require("../../services/adminService");

exports.login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw ApiError.badRequest("Email and password are required");
  const result = await adminService.login({ email, password });
  if (result.unauthorized) throw ApiError.unauthorized("Invalid email or password");
  // Return shape: token, role, user{id,name,email,isSuperAdmin?}
  return sendSuccessResponse(
    res,
    {
      token: result.token,
      role: result.role,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        ...(typeof result.user.isSuperAdmin === "boolean" ? { isSuperAdmin: result.user.isSuperAdmin } : {}),
      },
    },
    "Login successful"
  );
});
