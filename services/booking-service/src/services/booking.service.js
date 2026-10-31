import { bookingRepo } from "../database/repositories/booking.repo.js";
import { sagaCoordinator } from "./saga.coordinator.js";

function generateBookingId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "BK-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const bookingService = {
  async createBooking(payload) {
    if (!payload.eventId) throw new Error("Event ID is required");
    if (!Array.isArray(payload.seats) || payload.seats.length === 0) {
      throw new Error("At least one seat must be selected");
    }

    const bookingId = payload.bookingId || generateBookingId();
    const enrichedPayload = {
      ...payload,
      bookingId,
    };

    return await sagaCoordinator.executeBookingSaga(enrichedPayload);
  },

  async getBookingById(bookingId) {
    return await bookingRepo.getBookingById(bookingId);
  },

  async getUserBookings(query) {
    return await bookingRepo.getUserBookings(query);
  },

  async getBookedSeatsForEvent(eventId) {
    return await bookingRepo.getBookedSeatsForEvent(eventId);
  },

  async cancelBooking(bookingId, reason) {
    return await bookingRepo.cancelBooking(bookingId, reason);
  },
};

