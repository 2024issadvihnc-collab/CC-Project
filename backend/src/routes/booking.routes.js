import { Router } from "express";
import { bookingController } from "../controllers/booking.controller.js";
import { optionalAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/bookings", optionalAuth, bookingController.createBooking);
router.get("/bookings/:bookingId", optionalAuth, bookingController.getBookingById);
router.get("/bookings", optionalAuth, bookingController.getUserBookings);

export default router;

