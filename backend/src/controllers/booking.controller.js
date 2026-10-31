import { bookingService } from "../services/booking.service.js";

export const bookingController = {
  async createBooking(req, res, next) {
    try {
      const payload = req.body;
      // If user is authenticated via Bearer token, associate with their account
      if (req.user && !payload.user?.id) {
        payload.user = {
          ...payload.user,
          id: req.user.id,
          name: payload.user?.name || req.user.name,
          email: payload.user?.email || req.user.email,
          phone: payload.user?.phone || req.user.phone,
        };
      }

      const confirmedBooking = await bookingService.createBooking(payload);

      res.status(201).json({
        success: true,
        message: "Booking confirmed successfully.",
        bookingId: confirmedBooking.bookingId,
        booking: confirmedBooking,
      });
    } catch (err) {
      next(err);
    }
  },

  async getBookingById(req, res, next) {
    try {
      const { bookingId } = req.params;
      const booking = await bookingService.getBookingById(bookingId);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      res.json(booking);
    } catch (err) {
      next(err);
    }
  },

  async getUserBookings(req, res, next) {
    try {
      const { phone, email } = req.query;
      const userId = req.user?.id || null;

      const bookings = await bookingService.getUserBookings({ phone, email, userId });
      res.json(bookings);
    } catch (err) {
      next(err);
    }
  },
};

