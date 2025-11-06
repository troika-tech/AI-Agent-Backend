/**
 * Standardized response formatting utilities
 * Provides consistent response structure across all API endpoints
 */

/**
 * Format successful response
 * @param {any} data - The response data
 * @param {string} message - Optional success message
 * @param {number} statusCode - HTTP status code (default: 200)
 * @returns {Object} Formatted success response
 */
const formatSuccessResponse = (data = null, message = 'Success', statusCode = 200) => {
  const response = {
    success: true,
    status: statusCode,
    message
  };

  if (data !== null) {
    response.data = data;
  }

  return response;
};

/**
 * Format error response
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {any} errors - Additional error details (validation errors, etc.)
 * @param {string} stack - Error stack trace (only in development)
 * @returns {Object} Formatted error response
 */
const formatErrorResponse = (message, statusCode = 500, errors = null, stack = null) => {
  const response = {
    success: false,
    status: statusCode,
    message,
    error: message
  };

  if (errors) {
    response.errors = errors;
  }

  // Include stack trace only in development environment
  if (stack && process.env.NODE_ENV === 'development') {
    response.stack = stack;
  }

  return response;
};

/**
 * Format paginated response
 * @param {Array} data - The response data array
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @param {number} total - Total number of items
 * @param {string} message - Optional success message
 * @returns {Object} Formatted paginated response
 */
const formatPaginatedResponse = (data, page, limit, total, message = 'Success') => {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    success: true,
    status: 200,
    message,
    data,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages,
      hasNextPage,
      hasPrevPage
    }
  };
};

/**
 * Send success response
 * @param {Object} res - Express response object
 * @param {any} data - The response data
 * @param {string} message - Optional success message
 * @param {number} statusCode - HTTP status code (default: 200)
 */
const sendSuccessResponse = (res, data = null, message = 'Success', statusCode = 200) => {
  const response = formatSuccessResponse(data, message, statusCode);
  return res.status(statusCode).json(response);
};

/**
 * Send error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {any} errors - Additional error details
 */
const sendErrorResponse = (res, message, statusCode = 500, errors = null) => {
  const response = formatErrorResponse(message, statusCode, errors);
  return res.status(statusCode).json(response);
};

/**
 * Send paginated response
 * @param {Object} res - Express response object
 * @param {Array} data - The response data array
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @param {number} total - Total number of items
 * @param {string} message - Optional success message
 */
const sendPaginatedResponse = (res, data, page, limit, total, message = 'Success') => {
  const response = formatPaginatedResponse(data, page, limit, total, message);
  return res.status(200).json(response);
};

module.exports = {
  formatSuccessResponse,
  formatErrorResponse,
  formatPaginatedResponse,
  sendSuccessResponse,
  sendErrorResponse,
  sendPaginatedResponse
};
