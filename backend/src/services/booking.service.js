import crypto from "crypto";
import { bookingRepo, SeatConflictError } from "../database/repositories/booking.repo.js";
import { eventService } from "./event.service.js";
import { redisService } from "./redis.service.js";

export class BookingValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "BookingValidationError";
    this.status = 400;
  }
}

export const bookingService = {
  async createBooking(payload) {
    const { eventId, event: passedEvent, tickets, seats, total, user, paymentMethod, coupon } = payload;

    if (!seats || !Array.isArray(seats) || seats.length === 0) {
      throw new BookingValidationError("Please select at least one seat to book");
    }

    const targetId = eventId || passedEvent?.id;
    if (!targetId) {
      throw new BookingValidationError("Event ID is required");
    }

    // Resolve event details
    let event = await eventService.getEventById(targetId);
    if (!event) {
      event = passedEvent;
    }
    if (!event) {
      throw new BookingValidationError("Event not found or has expired");
    }

    // Generate unique booking reference: ST + 6 alphanumeric characters
    const bookingId = "ST" + crypto.randomBytes(4).toString("hex").slice(0, 6).toUpperCase();

    const bookingResult = await bookingRepo.createBookingAtomic({
      bookingId,
      eventId: event.id,
      userId: user?.id || null,
      total: Math.round(total || 0),
      paymentMethod: paymentMethod || "upi",
      coupon: coupon || null,
      user: user || { name: "Guest", phone: "Guest" },
      event: {
        id: event.id,
        title: event.title,
        subtitle: event.subtitle,
        category: event.category,
        date: event.date,
        time: event.time,
        venue: event.venue,
        city: event.city,
        price: event.price,
        image: event.image || `/images/events/${event.id}.jpg`,
      },
      seats,
      tickets,
    });

    // Invalidate Redis event detail cache
    await redisService.del(`events:detail:${event.id}`);

    // Release any temporary holds for these seats
    for (const s of seats) {
      await redisService.releaseSeat(event.id, s);
    }

    console.log(`[BOOKING] Successfully confirmed reference: ${bookingId} for event "${event.title}"`);
    return bookingResult;
  },

  async getBookingById(bookingId) {
    if (!bookingId) return null;
    return await bookingRepo.getBookingById(bookingId);
  },

  async getUserBookings(query) {
    return await bookingRepo.getUserBookings(query);
  },
};

