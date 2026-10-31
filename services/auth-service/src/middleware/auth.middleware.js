import { verifyToken, extractBearerToken } from "../../../../shared/common-utils/jwt.js";
import { config } from "../config/env.config.js";

export function authenticate(req, res, next) {
  // If request already arrived with gateway forwarded headers
  if (req.headers["x-user-id"]) {
    req.user = {
      id: req.headers["x-user-id"],
      role: req.headers["x-user-role"] || "user",
      email: req.headers["x-user-email"] || null,
      phone: req.headers["x-user-phone"] || null,
    };
    return next();
  }

  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: "Authentication token required" });
  }

  const decoded = verifyToken(token, config.jwtSecret);
  if (!decoded) {
    return res.status(401).json({ success: false, error: "Invalid or expired session token" });
  }

  req.user = decoded;
  next();
}

export function optionalAuthenticate(req, res, next) {
  if (req.headers["x-user-id"]) {
    req.user = {
      id: req.headers["x-user-id"],
      role: req.headers["x-user-role"] || "user",
      email: req.headers["x-user-email"] || null,
    };
    return next();
  }

  const token = extractBearerToken(req);
  if (token) {
    const decoded = verifyToken(token, config.jwtSecret);
    if (decoded) req.user = decoded;
  }
  next();
}

