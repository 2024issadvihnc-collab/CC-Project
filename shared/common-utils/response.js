/**
 * Standard HTTP Response Formatters for ShowTime
 */

export function sendSuccess(res, data = null, message = "Success", statusCode = 200, extra = {}) {
  return res.status(statusCode).json({
    success: true,
    message,
    ...(data !== null ? { data } : {}),
    ...extra,
    timestamp: new Date().toISOString(),
  });
}

export function sendError(res, error, statusCode = 500) {
  const code = error.statusCode || error.status || statusCode;
  const message = error.message || "Internal server error";
  const details = error.details || error.conflictSeats ? { conflictSeats: error.conflictSeats } : undefined;

  return res.status(code).json({
    success: false,
    error: message,
    ...(details ? { details } : {}),
    timestamp: new Date().toISOString(),
  });
}

