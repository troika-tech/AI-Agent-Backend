const Company = require("../models/Company");
const Chatbot = require("../models/Chatbot");
const bcrypt = require("bcrypt");
const { deleteCompanyCascade } = require('../services/cascadeDelete');

// Import error handling utilities
const ApiError = require("../utils/ApiError");
const { sendSuccessResponse, sendErrorResponse } = require("../utils/responseFormatter");
const { catchAsync } = require("../middleware/errorHandler");
const { validateBody } = require("../utils/validationHelpers");

// Create a new company
exports.createCompany = catchAsync(async (req, res) => {
  if (!validateBody(req, res)) return;

  const { name, url, email, password } = req.body;

  if (!name || !url || !email || !password) {
    throw ApiError.badRequest("All fields are required");
  }

  const existingEmail = await Company.findOne({ email });
  if (existingEmail) {
    throw ApiError.conflict("Email is already registered");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const company = new Company({
    name,
    url,
    email: email.toLowerCase(),
    password_hash: hashedPassword,
    created_at: new Date(),
  });

  await company.save();

  return sendSuccessResponse(res, company, "Company registered successfully", 201);
});


// Edit existing company
exports.editCompany = catchAsync(async (req, res) => {
  if (!validateBody(req, res)) return;

  const { id } = req.params;
  const { name, url, password } = req.body;

  if (!name && !url && !password) {
    throw ApiError.badRequest("Nothing to update");
  }

  const updatePayload = {};
  if (name) updatePayload.name = name;
  if (url) updatePayload.url = url;

  // Handle password update
  if (password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    updatePayload.password_hash = hashedPassword;
  }

  const updatedCompany = await Company.findByIdAndUpdate(id, updatePayload, {
    new: true,
  });

  if (!updatedCompany) {
    throw ApiError.notFound("Company not found");
  }

  return sendSuccessResponse(res, updatedCompany, "Company updated successfully");
});

// Delete company (full cascade)
exports.deleteCompany = catchAsync(async (req, res) => {
  const { id } = req.params;
  const summary = await deleteCompanyCascade(id);
  return sendSuccessResponse(res, { summary }, "Company, chatbots, and related data deleted successfully");
});

// 📦 Get all companies with their chatbots
exports.getAllCompaniesWithChatbots = async (req, res) => {
  try {
    const companies = await Company.find().sort({ created_at: -1 });

    const enriched = await Promise.all(
      companies.map(async (company) => {
        const chatbots = await Chatbot.find({ company_id: company._id });
        return {
          ...company.toObject(),
          chatbots,
        };
      })
    );

    res.status(200).json({ companies: enriched });
  } catch (err) {
    console.error("Fetch companies error:", err.message);
    res.status(500).json({ message: "Error fetching companies and chatbots" });
  }
};
