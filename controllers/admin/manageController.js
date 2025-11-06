// controllers/admin/manageController.js
const { catchAsync } = require("../../middleware/errorHandler");
const { sendSuccessResponse } = require("../../utils/responseFormatter");
const ApiError = require("../../utils/ApiError");
const adminService = require("../../services/adminService");
const Admin = require("../../models/Admin");

exports.getStats = catchAsync(async (req, res) => {
  const stats = await adminService.stats();
  return sendSuccessResponse(res, stats, "Statistics fetched successfully");
});

exports.createAdmin = catchAsync(async (req, res) => {
  const { name, email, password, isSuperAdmin = false } = req.body;
  if (!name || !email || !password) throw ApiError.badRequest("Name, email, and password are required");
  const result = await adminService.createAdmin({ name, email, password, isSuperAdmin });
  if (result.conflict) throw ApiError.conflict("Admin with this email already exists");
  return sendSuccessResponse(res, { admin: result.admin }, "Admin created successfully", 201);
});

exports.editAdmin = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { name, email, password } = req.body;
  if (!name && !email && !password) throw ApiError.badRequest("Nothing to update");
  if (email) {
    const existing = await Admin.findOne({ email: email.toLowerCase(), _id: { $ne: id } });
    if (existing) throw ApiError.conflict("Email is already registered");
  }
  if (password && password.length < 6) throw ApiError.badRequest("Password must be at least 6 characters");
  const { updated } = await adminService.editAdmin(id, { name, email, password });
  if (!updated) throw ApiError.notFound("Admin not found");
  return sendSuccessResponse(res, null, "Admin updated successfully");
});

exports.getAllAdmins = catchAsync(async (req, res) => {
  const admins = await adminService.getAllAdmins();
  return sendSuccessResponse(res, { admins }, "Admins fetched successfully");
});

exports.deleteAdmin = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (req.user.id === id) throw ApiError.forbidden("Action forbidden: You cannot delete your own account");
  const { deleted } = await adminService.deleteAdmin(id);
  if (!deleted) throw ApiError.notFound("Admin not found");
  return sendSuccessResponse(res, null, "Admin deleted successfully");
});

exports.toggleSuperAdmin = catchAsync(async (req, res) => {
  const { id } = req.params;
  const admin = await Admin.findById(id);
  if (!admin) throw ApiError.notFound("Admin not found");
  if (admin.isSuperAdmin && req.user.id === id) {
    const superAdminCount = await Admin.countDocuments({ isSuperAdmin: true });
    if (superAdminCount <= 1) throw ApiError.forbidden("Action forbidden: Cannot revoke status from the last super admin");
  }
  const { isSuperAdmin } = await adminService.toggleSuperAdmin(id);
  return sendSuccessResponse(res, { isSuperAdmin }, `Admin role updated. User is now ${isSuperAdmin ? "a super admin" : "a regular admin"}`);
});
