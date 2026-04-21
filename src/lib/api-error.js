class ApiError extends Error {
  constructor(statusCode, message, options = {}) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = options.code;
    this.details = options.details;
    this.retryAfterMs = options.retryAfterMs;
    this.exposeDetails = options.exposeDetails || false;
  }
}

module.exports = { ApiError };
