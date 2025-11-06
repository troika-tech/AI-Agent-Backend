/**
 * Custom API Error class for structured error handling
 * Extends the built-in Error class with additional properties
 */
class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, stack = '') {
    super(message);
    
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Factory methods for common error types
ApiError.badRequest = (message = 'Bad Request') => {
  return new ApiError(400, message);
};

ApiError.unauthorized = (message = 'Unauthorized') => {
  return new ApiError(401, message);
};

ApiError.forbidden = (message = 'Forbidden') => {
  return new ApiError(403, message);
};

ApiError.notFound = (message = 'Resource not found') => {
  return new ApiError(404, message);
};

ApiError.conflict = (message = 'Conflict') => {
  return new ApiError(409, message);
};

ApiError.unprocessableEntity = (message = 'Unprocessable Entity') => {
  return new ApiError(422, message);
};

ApiError.tooManyRequests = (message = 'Too Many Requests') => {
  return new ApiError(429, message);
};

ApiError.internalServer = (message = 'Internal Server Error') => {
  return new ApiError(500, message);
};

ApiError.notImplemented = (message = 'Not Implemented') => {
  return new ApiError(501, message);
};

ApiError.serviceUnavailable = (message = 'Service Unavailable') => {
  return new ApiError(503, message);
};

module.exports = ApiError;
