import { query, isDbConnected } from "../pool.js";

const inMemoryTickets = new Map();
const inMemoryScans = [];

export const ticketRepo = {
  async saveTicket({
    ticketReference,
    bookingReference,
    eventId,
    seatNumber,
    tier = "Reserved",
    price = 0,
    qrCodeData,
    verificationToken = null,
    attendeeName = null,
    attendeeEmail = null,
    attendeePhone = null,
  }) {
    if (isDbConnected()) {
      // Ensure verification_token column exists if table was created earlier
      await query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS verification_token VARCHAR(128);`).catch(() => {});

      const res = await query(
        `INSERT INTO tickets (
          ticket_reference, booking_reference, event_id, seat_number,
          tier, price, qr_code_data, verification_token, status,
          attendee_name, attendee_email, attendee_phone, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'VALID', $9, $10, $11, NOW())
        RETURNING id, ticket_reference, booking_reference, event_id, seat_number, tier, price, qr_code_data, verification_token, status, created_at`,
        [
          ticketReference,
          bookingReference,
          eventId,
          seatNumber,
          tier,
          price,
          qrCodeData,
          verificationToken,
          attendeeName,
          attendeeEmail,
          attendeePhone,
        ]
      );
      return res.rows[0];
    }

    const rec = {
      ticket_reference: ticketReference,
      booking_reference: bookingReference,
      event_id: eventId,
      seat_number: seatNumber,
      tier,
      price,
      qr_code_data: qrCodeData,
      verification_token: verificationToken,
      status: "VALID",
      attendee_name: attendeeName,
      created_at: new Date().toISOString(),
    };
    inMemoryTickets.set(ticketReference.toUpperCase(), rec);
    if (verificationToken) {
      inMemoryTickets.set(verificationToken.toUpperCase(), rec);
    }
    return rec;
  },

  async findByTokenOrRef(identifier) {
    if (!identifier) return null;
    const clean = identifier.trim().toUpperCase();

    if (isDbConnected()) {
      await query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS verification_token VARCHAR(128);`).catch(() => {});
      const res = await query(
        `SELECT id, ticket_reference, booking_reference, event_id, seat_number, tier, price, qr_code_data, verification_token, status, attendee_name, scanned_at, created_at
         FROM tickets
         WHERE UPPER(ticket_reference) = $1
            OR UPPER(verification_token) = $1
            OR UPPER(booking_reference) = $1
         ORDER BY id ASC
         LIMIT 1`,
        [clean]
      );
      return res.rows[0] || null;
    }

    return inMemoryTickets.get(clean) || null;
  },

  async findByBookingRef(bookingReference) {
    if (!bookingReference) return [];
    const clean = bookingReference.trim().toUpperCase();

    if (isDbConnected()) {
      const res = await query(
        `SELECT id, ticket_reference, booking_reference, event_id, seat_number, tier, price, qr_code_data, verification_token, status, attendee_name, scanned_at, created_at
         FROM tickets
         WHERE UPPER(booking_reference) = $1
         ORDER BY id ASC`,
        [clean]
      );
      return res.rows;
    }

    return Array.from(new Set(inMemoryTickets.values())).filter(
      (t) => t.booking_reference && t.booking_reference.toUpperCase() === clean
    );
  },

  /**
   * Atomic Ticket Scan and Admission.
   * Guarantees concurrent scans cannot double-admit the same ticket.
   */
  async atomicScanTicket(identifier, gateLocation = "MAIN_ENTRANCE", scannedBy = "gate_scanner_01") {
    if (!identifier) {
      return { valid: false, code: "INVALID", reason: "Ticket identifier is missing" };
    }
    const clean = identifier.trim().toUpperCase();

    if (isDbConnected()) {
      await query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS verification_token VARCHAR(128);`).catch(() => {});

      // 1. Atomic Check-And-Set: Only updates if status is currently VALID
      const updateRes = await query(
        `UPDATE tickets
         SET status = 'USED', scanned_at = NOW()
         WHERE (UPPER(ticket_reference) = $1 OR UPPER(verification_token) = $1)
           AND status = 'VALID'
         RETURNING id, ticket_reference, booking_reference, event_id, seat_number, tier, price, status, attendee_name, scanned_at`,
        [clean]
      );

      // If exactly 1 row was updated, admission is guaranteed and atomic!
      if (updateRes.rows.length === 1) {
        const ticket = updateRes.rows[0];

        // Record scan audit log
        await query(
          `INSERT INTO ticket_scans (ticket_reference, scanned_by, gate_location, scan_result, scanned_at)
           VALUES ($1, $2, $3, 'ADMITTED', NOW())`,
          [ticket.ticket_reference, scannedBy, gateLocation]
        );

        return {
          valid: true,
          admitted: true,
          code: "ADMITTED",
          message: `Ticket Verified! Admitted seat ${ticket.seat_number}`,
          ticket,
          gateLocation,
          scannedBy,
          scannedAt: ticket.scanned_at,
        };
      }

      // If 0 rows were updated, check why
      const checkRes = await query(
        `SELECT id, ticket_reference, booking_reference, event_id, seat_number, tier, price, status, attendee_name, scanned_at
         FROM tickets
         WHERE UPPER(ticket_reference) = $1 OR UPPER(verification_token) = $1`,
        [clean]
      );

      if (checkRes.rows.length === 0) {
        return {
          valid: false,
          admitted: false,
          code: "NOT_FOUND",
          reason: "Ticket not found in system. Please verify ticket reference.",
        };
      }

      const existing = checkRes.rows[0];
      if (existing.status === "CANCELLED") {
        await query(
          `INSERT INTO ticket_scans (ticket_reference, scanned_by, gate_location, scan_result, scanned_at)
           VALUES ($1, $2, $3, 'REJECTED_CANCELLED', NOW())`,
          [existing.ticket_reference, scannedBy, gateLocation]
        ).catch(() => {});

        return {
          valid: false,
          admitted: false,
          code: "CANCELLED",
          reason: "Entry Denied: This booking was CANCELLED and refunded.",
          ticket: existing,
        };
      }

      if (existing.status === "USED" || existing.scanned_at) {
        await query(
          `INSERT INTO ticket_scans (ticket_reference, scanned_by, gate_location, scan_result, scanned_at)
           VALUES ($1, $2, $3, 'REJECTED_ALREADY_USED', NOW())`,
          [existing.ticket_reference, scannedBy, gateLocation]
        ).catch(() => {});

        return {
          valid: false,
          admitted: false,
          code: "ALREADY_USED",
          reason: `Ticket already used at ${new Date(existing.scanned_at).toLocaleTimeString("en-IN")}. Duplicate entry rejected.`,
          ticket: existing,
        };
      }

      return {
        valid: false,
        admitted: false,
        code: "INVALID_STATUS",
        reason: `Ticket status is ${existing.status}. Entry cannot be granted.`,
        ticket: existing,
      };
    }

    // In-memory fallback
    const t = inMemoryTickets.get(clean);
    if (!t) {
      return { valid: false, admitted: false, code: "NOT_FOUND", reason: "Ticket not found in system." };
    }
    if (t.status === "CANCELLED") {
      return { valid: false, admitted: false, code: "CANCELLED", reason: "Entry Denied: Ticket has been CANCELLED and refunded.", ticket: t };
    }
    if (t.status === "USED") {
      return {
        valid: false,
        admitted: false,
        code: "ALREADY_USED",
        reason: `Ticket already used at ${t.scanned_at || "previous scan"}. Duplicate entry rejected.`,
        ticket: t,
      };
    }

    t.status = "USED";
    t.scanned_at = new Date().toISOString();
    inMemoryScans.push({
      ticket_reference: t.ticket_reference,
      scanned_by: scannedBy,
      gate_location: gateLocation,
      scan_result: "ADMITTED",
      scanned_at: t.scanned_at,
    });

    return {
      valid: true,
      admitted: true,
      code: "ADMITTED",
      message: `Ticket Verified! Admitted seat ${t.seat_number}`,
      ticket: t,
      gateLocation,
      scannedBy,
      scannedAt: t.scanned_at,
    };
  },

  async invalidateTicketsByBooking(bookingReference, reason = "Booking cancelled") {
    if (!bookingReference) return 0;
    const clean = bookingReference.trim().toUpperCase();

    if (isDbConnected()) {
      const res = await query(
        `UPDATE tickets
         SET status = 'CANCELLED'
         WHERE UPPER(booking_reference) = $1 AND status != 'USED'
         RETURNING id`,
        [clean]
      );
      return res.rowCount;
    }

    let count = 0;
    for (const t of inMemoryTickets.values()) {
      if (t.booking_reference && t.booking_reference.toUpperCase() === clean && t.status !== "USED") {
        t.status = "CANCELLED";
        t.cancelled_reason = reason;
        count++;
      }
    }
    return count;
  },

  async getRecentScans(limit = 20) {
    if (isDbConnected()) {
      const res = await query(
        `SELECT s.id, s.ticket_reference, s.scanned_by, s.gate_location, s.scan_result, s.scanned_at,
                t.seat_number, t.tier, t.event_id, t.booking_reference, t.attendee_name
         FROM ticket_scans s
         LEFT JOIN tickets t ON s.ticket_reference = t.ticket_reference
         ORDER BY s.scanned_at DESC
         LIMIT $1`,
        [limit]
      );
      return res.rows;
    }

    return inMemoryScans.slice(-limit).reverse();
  },
};
