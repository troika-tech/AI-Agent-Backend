const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');
const { formatErrorResponse } = require('../utils/responseFormatter');

/**
 * Handle MongoDB Cast Errors (invalid ObjectId)
 */
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return ApiError.badRequest(message);
};

/**
 * Handle MongoDB Duplicate Field Errors
 */
const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return ApiError.badRequest(message);
};

/**
 * Handle MongoDB Validation Errors
 */
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return ApiError.badRequest(message);
};

/**
 * Handle JWT Errors
 */
const handleJWTError = () => ApiError.unauthorized('Invalid token. Please log in again!');

/**
 * Handle JWT Expired Errors
 */
const handleJWTExpiredError = () => ApiError.unauthorized('Your token has expired! Please log in again.');

/**
 * Send error response in development
 */
const sendErrorDev = (err, req, res) => {
  // Log the full error in development
  logger.error('💥 ERROR:', err);

  const response = formatErrorResponse(
    err.message,
    err.statusCode || 500,
    null,
    err.stack
  );

  return res.status(err.statusCode || 500).json(response);
};

/**
 * Send error response in production
 */
const sendErrorProd = (err, req, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    const response = formatErrorResponse(err.message, err.statusCode);
    return res.status(err.statusCode).json(response);
  }

  // Programming or other unknown error: don't leak error details
  console.error('💥 ERROR:', err);
  
  const response = formatErrorResponse(
    'Something went wrong!',
    500
  );

  return res.status(500).json(response);
};

/**
 * Global error handling middleware
 * Must be the last middleware in the stack
 */
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // Handle specific error types
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, req, res);
  }
};

/**
 * Middleware to handle unhandled routes
 */
const handleUnhandledRoutes = (req, res, next) => {
  const err = ApiError.notFound(`Can't find ${req.originalUrl} on this server!`);
  next(err);
};

/**
 * Catch async errors wrapper
 * Eliminates the need for try-catch blocks in async route handlers
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  globalErrorHandler,
  handleUnhandledRoutes,
  catchAsync
};
