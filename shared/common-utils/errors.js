/**
 * ShowTime Shared Error Hierarchy
 */

export class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.status = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad Request", details = null) {
    super(message, 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized access", details = null) {
    super(message, 401, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access forbidden", details = null) {
    super(message, 403, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", details = null) {
    super(message, 404, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict", details = null) {
    super(message, 409, details);
  }
}

export class SeatConflictError extends AppError {
  constructor(message = "Selected seat(s) are no longer available", conflictSeats = []) {
    super(message, 409, { conflictSeats });
    this.conflictSeats = conflictSeats;
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "Downstream service temporarily unavailable", details = null) {
    super(message, 503, details);
  }
}

