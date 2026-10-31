/**
 * Event Topics & Message Types across ShowTime Microservices
 */

export const TOPICS = {
  // Booking Saga Events
  BOOKING_INITIATED: "booking.initiated",
  SEATS_HELD: "booking.seats.held",
  SEATS_RELEASED: "booking.seats.released",
  BOOKING_CONFIRMED: "booking.confirmed",
  BOOKING_CANCELLED: "booking.cancelled",

  // Payment Events
  PAYMENT_INITIATED: "payment.initiated",
  PAYMENT_COMPLETED: "payment.completed",
  PAYMENT_FAILED: "payment.failed",
  PAYMENT_REFUNDED: "payment.refunded",

  // Ticket Events
  TICKET_GENERATED: "ticket.generated",
  TICKET_SCANNED: "ticket.scanned",
  TICKET_REVOKED: "ticket.revoked",

  // Event Catalog Events
  EVENT_UPDATED: "event.updated",
  EVENT_DELETED: "event.deleted",

  // User Events
  USER_REGISTERED: "user.registered",
  USER_DELETED: "user.deleted",
};

