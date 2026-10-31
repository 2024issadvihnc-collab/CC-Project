/**
 * Event Contract Validation Helpers
 */

export function validateEventPayload(topic, payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error(`Invalid event payload for topic ${topic}`);
  }

  const requiredFields = {
    "booking.initiated": ["bookingId", "eventId", "seats", "total"],
    "booking.confirmed": ["bookingId", "eventId", "seats", "total", "user"],
    "booking.cancelled": ["bookingId", "eventId", "reason"],
    "payment.completed": ["paymentId", "bookingId", "amount"],
    "payment.failed": ["bookingId", "reason"],
    "ticket.generated": ["ticketId", "bookingId", "eventId", "seats", "qrCode"],
  };

  const fields = requiredFields[topic];
  if (fields) {
    for (const f of fields) {
      if (payload[f] === undefined || payload[f] === null) {
        throw new Error(`Missing required field '${f}' in event ${topic}`);
      }
    }
  }

  return true;
}

