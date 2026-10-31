import { query, withTransaction, isDbConnected } from "../pool.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JSON_BOOKINGS_FILE = path.join(__dirname, "../../../data/bookings.json");

function readJsonBookings() {
  try {
    if (fs.existsSync(JSON_BOOKINGS_FILE)) {
      return JSON.parse(fs.readFileSync(JSON_BOOKINGS_FILE, "utf-8") || "[]");
    }
  } catch (_) {}
  return [];
}

function writeJsonBookings(data) {
  try {
    fs.writeFileSync(JSON_BOOKINGS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (_) {}
}

export class SeatConflictError extends Error {
  constructor(message, conflictSeats = []) {
    super(message);
    this.name = "SeatConflictError";
    this.status = 409;
    this.conflictSeats = conflictSeats;
  }
}

export const bookingRepo = {
  /**
   * Concurrency-safe atomic booking creation.
   * Guarantees that two simultaneous requests for the same seat cannot both succeed.
   */
  async createBookingAtomic({
    bookingId,
    eventId,
    userId,
    total,
    paymentMethod,
    coupon,
    user,
    event,
    seats,
    tickets,
  }) {
    if (isDbConnected()) {
      return await withTransaction(async (client) => {
        // 1. Lock and check if any requested seat is already booked or held
        const seatCheckRes = await client.query(
          `SELECT seat_number
           FROM booking_seats
           WHERE event_id = $1
             AND seat_number = ANY($2::text[])
             AND reservation_status IN ('HELD', 'CONFIRMED')
           FOR UPDATE`,
          [eventId, seats]
        );

        if (seatCheckRes.rows.length > 0) {
          const conflicting = seatCheckRes.rows.map((r) => r.seat_number);
          throw new SeatConflictError(
            `Seat(s) ${conflicting.join(", ")} are already reserved or booked. Please select different seats.`,
            conflicting
          );
        }

        // 2. Ensure user row exists if userId is provided
        let resolvedUserId = null;
        if (userId) {
          const uRes = await client.query(`SELECT id FROM users WHERE id = $1`, [userId]);
          if (uRes.rows.length > 0) resolvedUserId = userId;
        }

        // 3. Insert Booking record
        const bookingInsertRes = await client.query(
          `INSERT INTO bookings (
            booking_reference, user_id, event_id, total_amount,
            booking_status, payment_status, payment_method, coupon_code,
            user_details, event_snapshot, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, 'CONFIRMED', 'PAID', $5, $6, $7, $8, NOW(), NOW())
          RETURNING id, booking_reference, total_amount, created_at`,
          [
            bookingId,
            resolvedUserId,
            eventId,
            total,
            paymentMethod || "upi",
            coupon || null,
            JSON.stringify(user || {}),
            JSON.stringify(event || {}),
          ]
        );

        const dbBookingId = bookingInsertRes.rows[0].id;

        // 4. Insert each seat in booking_seats
        for (const s of seats) {
          const tInfo = (tickets || []).find((t) => t.seatId === s) || {};
          const tierName = tInfo.tierLabel || "Reserved";
          const seatPrice = tInfo.price || (event?.price || 0);

          try {
            await client.query(
              `INSERT INTO booking_seats (
                booking_id, event_id, seat_number, tier, price,
                reservation_status, created_at
              ) VALUES ($1, $2, $3, $4, $5, 'CONFIRMED', NOW())`,
              [dbBookingId, eventId, s, tierName, seatPrice]
            );
          } catch (insertErr) {
            // PostgreSQL unique partial index uq_active_event_seat violation (code 23505)
            if (insertErr.code === "23505") {
              throw new SeatConflictError(
                `Seat ${s} was just booked by another user. Please choose another seat.`,
                [s]
              );
            }
            throw insertErr;
          }
        }

        // 5. Insert Payment record
        const paymentRef = "PAY_" + bookingId + "_" + Date.now().toString(36).toUpperCase();
        await client.query(
          `INSERT INTO payments (
            booking_id, payment_reference, amount, payment_status,
            payment_gateway, created_at
          ) VALUES ($1, $2, $3, 'COMPLETED', $4, NOW())`,
          [dbBookingId, paymentRef, total, (paymentMethod || "UPI").toUpperCase()]
        );

        return {
          id: dbBookingId,
          bookingId,
          eventId,
          event,
          seats,
          tickets: tickets || seats.map((s) => ({ seatId: s, price: event?.price, tierLabel: "Reserved" })),
          total,
          paymentMethod: paymentMethod || "upi",
          coupon: coupon || null,
          user: user || {},
          paidAt: bookingInsertRes.rows[0].created_at,
          status: "CONFIRMED",
        };
      });
    }

    // Fallback if DB is disconnected in development
    const bookings = readJsonBookings();
    const eventBookings = bookings.filter((b) => b.eventId === eventId || b.event?.id === eventId);
    const alreadySold = new Set();
    eventBookings.forEach((b) => (b.seats || []).forEach((s) => alreadySold.add(s)));

    const conflicts = seats.filter((s) => alreadySold.has(s));
    if (conflicts.length > 0) {
      throw new SeatConflictError(
        `Seat(s) ${conflicts.join(", ")} are already booked. Please choose other seats.`,
        conflicts
      );
    }

    const newBooking = {
      bookingId,
      eventId,
      event,
      seats,
      tickets: tickets || seats.map((s) => ({ seatId: s, price: event?.price, tierLabel: "Reserved" })),
      total: Math.round(total || 0),
      paymentMethod: paymentMethod || "upi",
      coupon: coupon || null,
      user: user || { phone: "Guest", name: "Guest" },
      paidAt: new Date().toISOString(),
      status: "CONFIRMED",
    };

    bookings.unshift(newBooking);
    writeJsonBookings(bookings);
    return newBooking;
  },

  async getBookingById(bookingId) {
    if (!bookingId) return null;
    const cleanRef = bookingId.trim().toUpperCase();

    if (isDbConnected()) {
      const bRes = await query(
        `SELECT
           b.id, b.booking_reference AS "bookingId", b.event_id AS "eventId",
           b.total_amount AS total, b.booking_status AS status,
           b.payment_method AS "paymentMethod", b.coupon_code AS coupon,
           b.user_details AS user, b.event_snapshot AS event,
           b.created_at AS "paidAt"
         FROM bookings b
         WHERE UPPER(b.booking_reference) = $1`,
        [cleanRef]
      );

      if (bRes.rows.length === 0) return null;
      const b = bRes.rows[0];

      const sRes = await query(
        `SELECT seat_number AS "seatId", tier AS "tierLabel", price
         FROM booking_seats
         WHERE booking_id = $1`,
        [b.id]
      );

      return {
        ...b,
        seats: sRes.rows.map((s) => s.seatId),
        tickets: sRes.rows,
      };
    }

    const bookings = readJsonBookings();
    return bookings.find((b) => b.bookingId.toUpperCase() === cleanRef) || null;
  },

  async getUserBookings({ phone, email, userId }) {
    if (isDbConnected()) {
      const cleanPhone = phone ? phone.replace(/\D/g, "").slice(-10) : "";
      const cleanEmail = email ? email.trim().toLowerCase() : "";

      let sql = `
        SELECT
          b.id, b.booking_reference AS "bookingId", b.event_id AS "eventId",
          b.total_amount AS total, b.booking_status AS status,
          b.payment_method AS "paymentMethod", b.coupon_code AS coupon,
          b.user_details AS user, b.event_snapshot AS event,
          b.created_at AS "paidAt"
        FROM bookings b
        WHERE 1=1
      `;
      const params = [];

      if (userId) {
        params.push(userId);
        sql += ` AND b.user_id = $${params.length}`;
      } else if (cleanPhone || cleanEmail) {
        const conditions = [];
        if (cleanPhone) {
          params.push(cleanPhone);
          conditions.push(`RIGHT(REGEXP_REPLACE(COALESCE(b.user_details->>'phone', ''), '[^0-9]', '', 'g'), 10) = $${params.length}`);
        }
        if (cleanEmail) {
          params.push(cleanEmail);
          conditions.push(`LOWER(COALESCE(b.user_details->>'email', '')) = $${params.length}`);
        }
        sql += ` AND (${conditions.join(" OR ")})`;
      }

      sql += ` ORDER BY b.created_at DESC`;

      const res = await query(sql, params);
      const bookingsList = res.rows;

      for (const b of bookingsList) {
        const sRes = await query(
          `SELECT seat_number AS "seatId", tier AS "tierLabel", price
           FROM booking_seats
           WHERE booking_id = $1`,
          [b.id]
        );
        b.seats = sRes.rows.map((s) => s.seatId);
        b.tickets = sRes.rows;
      }

      return bookingsList;
    }

    const bookings = readJsonBookings();
    if (phone || email) {
      const cleanPhone = phone ? phone.replace(/\D/g, "").slice(-10) : "";
      const cleanEmail = email ? email.trim().toLowerCase() : "";

      return bookings.filter((b) => {
        const bPhone = (b.user?.phone || "").replace(/\D/g, "").slice(-10);
        const bEmail = (b.user?.email || "").trim().toLowerCase();
        const matchPhone = cleanPhone && bPhone === cleanPhone;
        const matchEmail = cleanEmail && bEmail === cleanEmail;
        return matchPhone || matchEmail;
      });
    }
    return bookings;
  },
};

