import jwt from "jsonwebtoken";
import { config } from "../config/env.config.js";

/**
 * Staff and Administrator authorization guard.
 * Allows access if:
 * 1. User role is 'admin' or 'staff' (from API Gateway propagated X-User-Role header or JWT)
 * 2. Or request provides valid authorization header with staff role
 * 3. Or gate scanner demo PIN is provided
 */
export function requireStaffOrAdmin(req, res, next) {
  const userRole = req.headers["x-user-role"];
  const userId = req.headers["x-user-id"];

  if (userRole === "admin" || userRole === "staff") {
    req.staff = { id: userId || "staff_gate", role: userRole };
    return next();
  }

  // Check Bearer Token if present
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.decode(token);
      if (decoded && (decoded.role === "admin" || decoded.role === "staff")) {
        req.staff = { id: decoded.id || "staff_gate", role: decoded.role };
        return next();
      }
    } catch (_) {}
  }

  // Demo staff pin verification (e.g. for demonstration or field tablet scanners)
  const staffPin = req.headers["x-staff-pin"] || req.body?.staffPin;
  if (staffPin === "1234" || staffPin === "ADMIN" || staffPin === "STAFF") {
    req.staff = { id: req.body?.scannedBy || "staff_gate_01", role: "staff" };
    return next();
  }

  // Also allow requests from internal services (like Booking Service)
  const isInternal = req.headers["x-internal-service"];
  if (isInternal) {
    req.staff = { id: "internal_service", role: "service" };
    return next();
  }

  return res.status(403).json({
    success: false,
    error: "Unauthorized: Ticket validation and scanning requires event staff or administrator privileges.",
  });
}

