/**
 * JWT Utilities for ShowTime Microservices
 */
import jwt from "jsonwebtoken";

const DEFAULT_SECRET = process.env.JWT_SECRET || "showtime-production-jwt-secret-key-change-in-prod";
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "1h";
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

export function signAccessToken(payload, secret = DEFAULT_SECRET, expiresIn = ACCESS_EXPIRES_IN) {
  return jwt.sign(payload, secret, { expiresIn });
}

export function signRefreshToken(payload, secret = DEFAULT_SECRET, expiresIn = REFRESH_EXPIRES_IN) {
  return jwt.sign({ ...payload, tokenType: "refresh" }, secret, { expiresIn });
}

export function verifyToken(token, secret = DEFAULT_SECRET) {
  try {
    return jwt.verify(token, secret);
  } catch (err) {
    return null;
  }
}

export function extractBearerToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
    return parts[1];
  }
  return null;
}

