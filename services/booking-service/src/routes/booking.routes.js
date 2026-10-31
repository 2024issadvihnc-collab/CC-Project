import { Router } from "express";
import { bookingController } from "../controllers/booking.controller.js";
import { optionalAuthenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/", optionalAuthenticate, bookingController.createBooking);
router.get("/", optionalAuthenticate, bookingController.getUserBookings);
router.get("/:id", optionalAuthenticate, bookingController.getBookingById);
router.post("/:id/cancel", optionalAuthenticate, bookingController.cancelBooking);
router.get("/:id/cancellation", optionalAuthenticate, bookingController.getCancellation);
router.delete("/:id", optionalAuthenticate, bookingController.cancelBooking);
router.get("/events/:eventId/seats", bookingController.getEventSeats);

export default router;

