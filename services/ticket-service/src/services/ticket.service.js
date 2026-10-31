import crypto from "crypto";
import { ticketRepo } from "../database/repositories/ticket.repo.js";
import { qrService } from "./qr.service.js";
import { config } from "../config/env.config.js";

function generateVerificationToken(ticketReference, bookingReference, eventId, seat) {
  return crypto
    .createHmac("sha256", config.ticketSecret)
    .update(`${ticketReference}:${bookingReference}:${eventId}:${seat}`)
    .digest("hex");
}

function parseInputTokenOrRef(rawInput) {
  if (!rawInput) return null;
  const trimmed = rawInput.trim();

  // Try parsing JSON QR payload
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      return parsed.tok || parsed.ref || parsed.ticketReference || parsed.bookingReference || null;
    } catch (_) {}
  }

  return trimmed;
}

export const ticketService = {
  async generateTicketsForBooking({ bookingReference, eventId, eventTitle, seats, total, user }) {
    if (!bookingReference) throw new Error("Booking reference is required");
    if (!seats || !Array.isArray(seats) || seats.length === 0) {
      throw new Error("Seats array is required");
    }

    const tickets = [];

    for (const seat of seats) {
      const ticketReference = `TKT_${bookingReference}_${seat}`;
      const verificationToken = generateVerificationToken(ticketReference, bookingReference, eventId, seat);

      // Secure QR payload: NO PII (no phone, no email, no attendee name)
      const qrPayload = {
        v: 1,
        app: "ShowTime",
        ref: ticketReference,
        bkg: bookingReference,
        seat,
        tok: verificationToken,
      };

      const qrDataUrl = await qrService.generateQrCodeDataUrl(qrPayload);

      const savedTicket = await ticketRepo.saveTicket({
        ticketReference,
        bookingReference,
        eventId,
        seatNumber: seat,
        tier: "Reserved",
        price: Math.round(total / seats.length),
        qrCodeData: qrDataUrl,
        verificationToken,
        attendeeName: user?.name || "Guest",
        attendeeEmail: user?.email || null,
        attendeePhone: user?.phone || null,
      });

      tickets.push({
        ...savedTicket,
        qrCode: qrDataUrl,
      });
    }

    return {
      bookingReference,
      ticketCount: tickets.length,
      tickets,
    };
  },

  async getTicket(identifier) {
    const parsed = parseInputTokenOrRef(identifier);
    return await ticketRepo.findByTokenOrRef(parsed);
  },

  async getTicketsByBooking(bookingReference) {
    return await ticketRepo.findByBookingRef(bookingReference);
  },

  async validateTicket(rawInput) {
    const identifier = parseInputTokenOrRef(rawInput);
    if (!identifier) {
      return { valid: false, code: "INVALID", reason: "Invalid ticket QR code or reference." };
    }

    const ticket = await ticketRepo.findByTokenOrRef(identifier);
    if (!ticket) {
      return { valid: false, code: "NOT_FOUND", reason: "Ticket not found in system." };
    }

    if (ticket.status === "CANCELLED") {
      return { valid: false, code: "CANCELLED", reason: "Ticket has been CANCELLED and refunded. Entry denied.", ticket };
    }

    if (ticket.status === "USED" || ticket.scanned_at) {
      return {
        valid: false,
        code: "ALREADY_USED",
        reason: `Ticket was already used for entry at ${new Date(ticket.scanned_at).toLocaleTimeString("en-IN")}. Duplicate entry rejected.`,
        ticket,
      };
    }

    return {
      valid: true,
      code: "VALID",
      message: `Valid Ticket: Seat ${ticket.seat_number}`,
      ticket,
    };
  },

  async scanTicket(rawInput, gateLocation = "MAIN_ENTRANCE", scannedBy = "gate_scanner_01") {
    const identifier = parseInputTokenOrRef(rawInput);
    return await ticketRepo.atomicScanTicket(identifier, gateLocation, scannedBy);
  },

  async invalidateTicketsForBooking(bookingReference, reason = "Booking cancelled") {
    return await ticketRepo.invalidateTicketsByBooking(bookingReference, reason);
  },

  async getRecentScans(limit = 20) {
    return await ticketRepo.getRecentScans(limit);
  },
};
