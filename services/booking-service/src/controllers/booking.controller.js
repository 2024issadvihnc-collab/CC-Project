import { bookingService } from "../services/booking.service.js";
import { cancellationService } from "../services/cancellation.service.js";
import { sendSuccess, sendError } from "../../../../shared/common-utils/response.js";

export const bookingController = {
  async createBooking(req, res) {
    try {
      const payload = {
        ...req.body,
        userId: req.user?.id || req.headers["x-user-id"] || req.body.userId || req.body.user?.id,
      };
      const booking = await bookingService.createBooking(payload);
      return res.status(201).json(booking);
    } catch (err) {
      const status = err.statusCode || err.status || 400;
      return res.status(status).json({
        error: err.message,
        conflictSeats: err.conflictSeats || [],
      });
    }
  },

  async getBookingById(req, res) {
    try {
      const booking = await bookingService.getBookingById(req.params.id);
      if (!booking) return res.status(404).json({ error: "Booking not found" });
      return res.json(booking);
    } catch (err) {
      return sendError(res, err, 500);
    }
  },

  async getUserBookings(req, res) {
    try {
      const query = {
        phone: req.query.phone,
        email: req.query.email,
        userId: req.user?.id || req.query.userId,
      };
      const bookings = await bookingService.getUserBookings(query);
      return res.json(bookings);
    } catch (err) {
      return sendError(res, err, 500);
    }
  },

  async getEventSeats(req, res) {
    try {
      const bookedSeats = await bookingService.getBookedSeatsForEvent(req.params.eventId);
      return sendSuccess(res, { eventId: req.params.eventId, bookedSeats });
    } catch (err) {
      return sendError(res, err, 500);
    }
  },

  async cancelBooking(req, res) {
    try {
      const bookingReference = req.params.id;
      const userId = req.headers["x-user-id"] || req.user?.id;
      const userRole = req.headers["x-user-role"] || req.user?.role;
      const reason = req.body?.reason || "Customer requested cancellation";

      const result = await cancellationService.executeCancellation({
        bookingReference,
        userId,
        userRole,
        reason,
      });
      return sendSuccess(res, result, result.message || "Booking cancelled successfully");
    } catch (err) {
      return sendError(res, err, err.statusCode || 500);
    }
  },

  async getCancellation(req, res) {
    try {
      const bookingReference = req.params.id;
      const result = await cancellationService.getCancellation(bookingReference);
      if (!result) {
        const preview = await cancellationService.previewCancellation(bookingReference);
        return sendSuccess(res, preview);
      }
      return sendSuccess(res, result);
    } catch (err) {
      return sendError(res, err, err.statusCode || 500);
    }
  },
};

