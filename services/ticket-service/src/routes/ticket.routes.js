import { Router } from "express";
import { ticketController } from "../controllers/ticket.controller.js";
import { requireStaffOrAdmin } from "../middleware/staffAuth.middleware.js";

const router = Router();

// Ticket Generation (Internal / Booking Service)
router.post("/generate", ticketController.generate);

// Staff Ticket Scanning & Validation
router.post("/validate", requireStaffOrAdmin, ticketController.validate);
router.post("/scan", requireStaffOrAdmin, ticketController.scan);
router.post("/:ref/scan", requireStaffOrAdmin, ticketController.scan);
router.get("/scans/recent", requireStaffOrAdmin, ticketController.getRecentScans);

// Invalidation (upon booking cancellation)
router.post("/invalidate", ticketController.invalidate);

// Lookup
router.get("/booking/:bookingRef", ticketController.getByBooking);
router.get("/:ref", ticketController.getByRef);

export default router;
