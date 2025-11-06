const ApiError = require('../utils/ApiError');

describe('ApiError', () => {
  it('creates badRequest with correct props', () => {
    const err = ApiError.badRequest('Invalid');
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(400);
    expect(err.status).toBe('fail');
    expect(err.message).toBe('Invalid');
    expect(err.isOperational).toBe(true);
    expect(err.stack).toBeTruthy();
  });

  it('maps 5xx to error status and allows custom stack', () => {
    const err = new ApiError(503, 'Down', true, 'STACK');
    expect(err.status).toBe('error');
    expect(err.stack).toBe('STACK');
  });

  it('factory helpers return proper codes', () => {
    expect(ApiError.unauthorized().statusCode).toBe(401);
    expect(ApiError.forbidden().statusCode).toBe(403);
    expect(ApiError.notFound().statusCode).toBe(404);
    expect(ApiError.conflict().statusCode).toBe(409);
    expect(ApiError.unprocessableEntity().statusCode).toBe(422);
    expect(ApiError.tooManyRequests().statusCode).toBe(429);
    expect(ApiError.internalServer().statusCode).toBe(500);
    expect(ApiError.notImplemented().statusCode).toBe(501);
    expect(ApiError.serviceUnavailable().statusCode).toBe(503);
  });
});
