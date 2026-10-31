import { config } from "../config/env.config.js";

export function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: `Resource not found: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(err, req, res, next) {
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || "An unexpected internal server error occurred";

  if (statusCode >= 500) {
    console.error(`[ERROR 500] ${req.method} ${req.originalUrl}:`, err);
  } else {
    console.warn(`[WARN ${statusCode}] ${req.method} ${req.originalUrl}: ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    code: err.code || undefined,
    conflictSeats: err.conflictSeats || undefined,
    ...(config.isDevelopment && { stack: err.stack }),
  });
}

