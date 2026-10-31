import jwt from "jsonwebtoken";
import { config } from "../config/env.config.js";

export function extractAndPropagateUser(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) return next();

  const parts = authHeader.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
    const token = parts[1];
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      if (decoded && decoded.id) {
        req.headers["x-user-id"] = decoded.id;
        req.headers["x-user-role"] = decoded.role || "user";
        if (decoded.email) req.headers["x-user-email"] = decoded.email;
        if (decoded.phone) req.headers["x-user-phone"] = decoded.phone;
        req.user = decoded;
      }
    } catch (_) {
      // Allow downstream service to determine if token is strictly required
    }
  }
  next();
}

