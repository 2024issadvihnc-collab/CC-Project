import { query, withTransaction, isDbConnected } from "../pool.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { SeatConflictError } from "../../../../../shared/common-utils/errors.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JSON_BOOKINGS_FILE = path.join(__dirname, "../../../../../backend/data/bookings.json");

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

export const bookingRepo = {
  /**
   * Concurrency-safe atomic booking creation using PostgreSQL transaction + row locks.
   * Seats are placed in 'HELD' reservation status pending payment confirmation.
   */
  async createPendingBookingAtomic({
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
        // 1. Lock and verify seat availability (only confirmed bookings conflict)
        const seatCheckRes = await client.query(
          `SELECT seat_number
           FROM booking_seats
           WHERE event_id = $1
             AND seat_number = ANY($2::text[])
             AND reservation_status = 'CONFIRMED'
           FOR UPDATE`,
          [eventId, seats]
        );

        if (seatCheckRes.rows.length > 0) {
          const conflicting = seatCheckRes.rows.map((r) => r.seat_number);
          throw new SeatConflictError(
            `Seat(s) ${conflicting.join(", ")} are already booked. Please select different seats.`,
            conflicting
          );
        }

        // 2. Insert into bookings table in PENDING state
        const bookingInsertRes = await client.query(
          `INSERT INTO bookings (
            booking_reference, user_id, event_id, total_amount,
            booking_status, payment_status, payment_method, coupon_code,
            user_details, event_snapshot, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, 'PENDING', 'UNPAID', $5, $6, $7, $8, NOW(), NOW())
          RETURNING id, booking_reference, total_amount, created_at`,
          [
            bookingId,
            userId || null,
            eventId,
            total,
            paymentMethod || "upi",
            coupon || null,
            JSON.stringify(user || {}),
            JSON.stringify(event || {}),
          ]
        );

        const dbBookingId = bookingInsertRes.rows[0].id;

        // 3. Insert each seat into booking_seats with 'HELD' status
        for (const s of seats) {
          const tInfo = (tickets || []).find((t) => t.seatId === s) || {};
          const tierName = tInfo.tierLabel || "Reserved";
          const seatPrice = tInfo.price || (event?.price || 0);

          try {
            await client.query(
              `INSERT INTO booking_seats (
                booking_id, event_id, seat_number, tier, price,
                reservation_status, hold_expires_at, created_at
              ) VALUES ($1, $2, $3, $4, $5, 'HELD', NOW() + INTERVAL '10 minutes', NOW())`,
              [dbBookingId, eventId, s, tierName, seatPrice]
            );
          } catch (insertErr) {
            if (insertErr.code === "23505") {
              throw new SeatConflictError(
                `Seat ${s} was just held by another user. Please choose another seat.`,
                [s]
              );
            }
            throw insertErr;
          }
        }

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
          status: "PENDING",
        };
      });
    }

    // JSON fallback for local offline mode
    const bookings = readJsonBookings();
    const eventBookings = bookings.filter((b) => b.eventId === eventId || b.event?.id === eventId);
    const alreadySold = new Set();
    eventBookings.forEach((b) => {
      if (b.status !== "CANCELLED") {
        (b.seats || []).forEach((s) => alreadySold.add(s));
      }
    });

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
      status: "PENDING",
    };

    bookings.unshift(newBooking);
    writeJsonBookings(bookings);
    return newBooking;
  },

  /**
   * Confirms a pending booking after payment succeeds
   */
  async confirmBookingAtomic({ bookingId, paymentReference, paymentMethod }) {
    if (isDbConnected()) {
      return await withTransaction(async (client) => {
        const bRes = await client.query(
          `UPDATE bookings
           SET booking_status = 'CONFIRMED',
               payment_status = 'PAID',
               payment_method = COALESCE($2, payment_method),
               updated_at = NOW()
           WHERE booking_reference = $1
           RETURNING id, booking_reference, total_amount, event_id, created_at`,
          [bookingId, paymentMethod || "upi"]
        );
        if (bRes.rows.length === 0) return null;

        await client.query(
          `UPDATE booking_seats
           SET reservation_status = 'CONFIRMED', hold_expires_at = NULL
           WHERE booking_id = $1`,
          [bRes.rows[0].id]
        );

        return {
          id: bRes.rows[0].id,
          bookingId,
          status: "CONFIRMED",
          paymentStatus: "PAID",
          paymentReference,
        };
      });
    }

    const bookings = readJsonBookings();
    const idx = bookings.findIndex((b) => b.bookingId === bookingId);
    if (idx !== -1) {
      bookings[idx].status = "CONFIRMED";
      bookings[idx].paymentStatus = "PAID";
      bookings[idx].paymentReference = paymentReference;
      writeJsonBookings(bookings);
      return bookings[idx];
    }
    return null;
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
        `SELECT seat_number, tier, price
         FROM booking_seats
         WHERE booking_id = $1 AND reservation_status IN ('HELD', 'CONFIRMED')`,
        [b.id]
      );

      return {
        ...b,
        seats: sRes.rows.map((r) => r.seat_number),
        tickets: sRes.rows.map((r) => ({
          seatId: r.seat_number,
          tierLabel: r.tier,
          price: Number(r.price),
        })),
      };
    }

    const bookings = readJsonBookings();
    return bookings.find((b) => b.bookingId && b.bookingId.toUpperCase() === cleanRef) || null;
  },

  async getUserBookings({ phone, email, userId }) {
    if (isDbConnected()) {
      const cleanPhone = phone ? phone.replace(/\D/g, "").slice(-10) : null;
      const cleanEmail = email ? email.trim().toLowerCase() : null;

      let sql = `
        SELECT
          b.id, b.booking_reference AS "bookingId", b.event_id AS "eventId",
          b.total_amount AS total, b.booking_status AS status,
          b.payment_method AS "paymentMethod", b.payment_status AS "paymentStatus",
          b.coupon_code AS coupon, b.user_details AS user, b.event_snapshot AS event,
          b.created_at AS "paidAt"
        FROM bookings b
        WHERE b.booking_status IN ('CONFIRMED', 'CANCELLED')
      `;
      const params = [];

      if (userId) {
        params.push(userId);
        sql += ` AND b.user_id = $${params.length}`;
      } else if (cleanEmail && cleanPhone) {
        params.push(cleanEmail, `%${cleanPhone}`);
        sql += ` AND (LOWER(b.user_details->>'email') = $1 OR b.user_details->>'phone' LIKE $2)`;
      } else if (cleanEmail) {
        params.push(cleanEmail);
        sql += ` AND LOWER(b.user_details->>'email') = $1`;
      } else if (cleanPhone) {
        params.push(`%${cleanPhone}`);
        sql += ` AND b.user_details->>'phone' LIKE $1`;
      }

      sql += ` ORDER BY b.created_at DESC`;
      const bRes = await query(sql, params);

      const enriched = await Promise.all(
        bRes.rows.map(async (b) => {
          const sRes = await query(
            `SELECT seat_number, tier, price FROM booking_seats WHERE booking_id = $1`,
            [b.id]
          );
          return {
            ...b,
            seats: sRes.rows.map((r) => r.seat_number),
            tickets: sRes.rows.map((r) => ({
              seatId: r.seat_number,
              tierLabel: r.tier,
              price: Number(r.price),
            })),
          };
        })
      );
      return enriched;
    }

    const bookings = readJsonBookings();
    const cleanPhone = phone ? phone.replace(/\D/g, "").slice(-10) : "";
    const cleanEmail = email ? email.trim().toLowerCase() : "";

    return bookings
      .filter((b) => b.status === "CONFIRMED" || b.status === "CANCELLED")
      .filter((b) => {
        const u = b.user || {};
        const uPhone = (u.phone || "").replace(/\D/g, "").slice(-10);
        const uEmail = (u.email || "").trim().toLowerCase();

        if (cleanEmail && uEmail === cleanEmail) return true;
        if (cleanPhone && uPhone.includes(cleanPhone)) return true;
        return false;
      })
      .map((b) => ({
        ...b,
        seats: (b.seats && b.seats.length > 0) ? b.seats : (b.releasedSeats || []),
      }));
  },

  async getBookedSeatsForEvent(eventId) {
    if (isDbConnected()) {
      const res = await query(
        `SELECT DISTINCT seat_number
         FROM booking_seats
         WHERE event_id = $1
           AND reservation_status = 'CONFIRMED'`,
        [eventId]
      );
      return [...new Set(res.rows.map((r) => r.seat_number))];
    }

    const bookings = readJsonBookings();
    const eventBookings = bookings.filter(
      (b) => (b.eventId === eventId || b.event?.id === eventId) && b.status !== "CANCELLED"
    );
    const seats = [];
    eventBookings.forEach((b) => {
      if (Array.isArray(b.seats)) seats.push(...b.seats);
    });
    return [...new Set(seats)];
  },

  async cancelBooking(bookingId, reason = "Payment failed or cancelled") {
    if (isDbConnected()) {
      return await withTransaction(async (client) => {
        const bRes = await client.query(
          `UPDATE bookings
           SET booking_status = 'CANCELLED', payment_status = 'FAILED', updated_at = NOW()
           WHERE booking_reference = $1
           RETURNING id, booking_reference, event_id`,
          [bookingId]
        );
        if (bRes.rows.length === 0) return null;

        // Release seats
        await client.query(
          `UPDATE booking_seats
           SET reservation_status = 'RELEASED'
           WHERE booking_id = $1`,
          [bRes.rows[0].id]
        );

        return {
          bookingId,
          eventId: bRes.rows[0].event_id,
          status: "CANCELLED",
          reason,
        };
      });
    }

    const bookings = readJsonBookings();
    const idx = bookings.findIndex((b) => b.bookingId === bookingId);
    if (idx === -1) return null;
    bookings[idx].status = "CANCELLED";
    bookings[idx].paymentStatus = "FAILED";
    bookings[idx].seats = []; // release seats
    writeJsonBookings(bookings);
    return bookings[idx];
  },

  async recordCancellation({
    cancellationReference,
    bookingReference,
    userId,
    totalAmount,
    refundAmount,
    cancellationFee,
    refundPercentage,
    refundReference,
    refundStatus = "COMPLETED",
    reason = "Customer requested cancellation",
  }) {
    if (isDbConnected()) {
      const res = await query(
        `INSERT INTO booking_cancellations (
          cancellation_reference, booking_reference, user_id, total_amount,
          refund_amount, cancellation_fee, refund_percentage, refund_reference,
          refund_status, reason, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        RETURNING *`,
        [
          cancellationReference,
          bookingReference,
          userId,
          totalAmount,
          refundAmount,
          cancellationFee,
          refundPercentage,
          refundReference,
          refundStatus,
          reason,
        ]
      );
      // Update booking table
      await query(
        `UPDATE bookings
         SET booking_status = 'CANCELLED', payment_status = 'REFUNDED', updated_at = NOW()
         WHERE booking_reference = $1`,
        [bookingReference]
      );
      // Release seats
      await query(
        `UPDATE booking_seats
         SET reservation_status = 'RELEASED'
         WHERE booking_id IN (SELECT id FROM bookings WHERE booking_reference = $1)`,
        [bookingReference]
      );
      return res.rows[0];
    }

    const cancellationRecord = {
      cancellation_reference: cancellationReference,
      booking_reference: bookingReference,
      user_id: userId,
      total_amount: totalAmount,
      refund_amount: refundAmount,
      cancellation_fee: cancellationFee,
      refund_percentage: refundPercentage,
      refund_reference: refundReference,
      refund_status: refundStatus,
      reason,
      created_at: new Date().toISOString(),
    };

    const bookings = readJsonBookings();
    const b = bookings.find((x) => x.bookingId === bookingReference);
    if (b) {
      b.status = "CANCELLED";
      b.paymentStatus = "REFUNDED";
      b.cancellation = cancellationRecord;
      b.releasedSeats = [...(b.seats || [])];
      b.seats = [];
      writeJsonBookings(bookings);
    }

    return cancellationRecord;
  },

  async getCancellationByBookingReference(bookingReference) {
    if (isDbConnected()) {
      const res = await query(
        `SELECT * FROM booking_cancellations WHERE booking_reference = $1 ORDER BY created_at DESC LIMIT 1`,
        [bookingReference]
      );
      return res.rows[0] || null;
    }

    const bookings = readJsonBookings();
    const b = bookings.find((x) => x.bookingId === bookingReference);
    return b?.cancellation || null;
  },
};
