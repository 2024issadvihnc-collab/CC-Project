export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  console.error(`[Auth-Service Error] ${req.method} ${req.url} - ${err.message}`);

  res.status(statusCode).json({
    success: false,
    error: err.message || "Internal server error",
    timestamp: new Date().toISOString(),
  });
}

