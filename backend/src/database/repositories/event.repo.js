import { query, isDbConnected } from "../pool.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JSON_EVENTS_FILE = path.join(__dirname, "../../../data/events.json");
const JSON_BOOKINGS_FILE = path.join(__dirname, "../../../data/bookings.json");

function readJsonEvents() {
  try {
    if (fs.existsSync(JSON_EVENTS_FILE)) {
      return JSON.parse(fs.readFileSync(JSON_EVENTS_FILE, "utf-8") || "[]");
    }
  } catch (_) {}
  return [];
}

function readJsonBookings() {
  try {
    if (fs.existsSync(JSON_BOOKINGS_FILE)) {
      return JSON.parse(fs.readFileSync(JSON_BOOKINGS_FILE, "utf-8") || "[]");
    }
  } catch (_) {}
  return [];
}

export const eventRepo = {
  async getAllEvents({ category, city, q, sort } = {}) {
    if (isDbConnected()) {
      let sql = `
        SELECT
          id, title, subtitle, description, category, city, venue,
          TO_CHAR(event_date, 'YYYY-MM-DD') AS date,
          event_time AS time,
          duration, price, max_price AS "maxPrice",
          image_url AS image, rating, votes, tags,
          cast_members AS cast, total_seats AS "totalSeats",
          filled_pct AS "filledPct", status
        FROM events
        WHERE status = 'ACTIVE'
      `;
      const params = [];

      if (category && category !== "all") {
        params.push(category.toLowerCase());
        sql += ` AND LOWER(category) = $${params.length}`;
      }

      if (city && city !== "All") {
        params.push(city.toLowerCase());
        sql += ` AND LOWER(city) = $${params.length}`;
      }

      if (q && q.trim()) {
        params.push(`%${q.trim().toLowerCase()}%`);
        const pNum = params.length;
        sql += ` AND (LOWER(title) LIKE $${pNum} OR LOWER(venue) LIKE $${pNum} OR LOWER(city) LIKE $${pNum} OR LOWER(subtitle) LIKE $${pNum})`;
      }

      if (sort === "date") {
        sql += ` ORDER BY event_date ASC, event_time ASC`;
      } else if (sort === "price-asc") {
        sql += ` ORDER BY price ASC`;
      } else if (sort === "price-desc") {
        sql += ` ORDER BY price DESC`;
      } else if (sort === "popularity") {
        sql += ` ORDER BY votes DESC`;
      } else {
        sql += ` ORDER BY event_date ASC`;
      }

      const res = await query(sql, params);
      return res.rows;
    }

    // Fallback to JSON data if DB is offline during dev
    let events = readJsonEvents();
    if (category && category !== "all") {
      events = events.filter((e) => e.category === category);
    }
    if (city && city !== "All") {
      events = events.filter((e) => e.city.toLowerCase() === city.toLowerCase());
    }
    if (q && q.trim()) {
      const term = q.trim().toLowerCase();
      events = events.filter(
        (e) =>
          e.title.toLowerCase().includes(term) ||
          e.venue.toLowerCase().includes(term) ||
          e.city.toLowerCase().includes(term) ||
          (e.subtitle && e.subtitle.toLowerCase().includes(term))
      );
    }
    if (sort) {
      if (sort === "date") events.sort((a, b) => new Date(a.date) - new Date(b.date));
      else if (sort === "price-asc") events.sort((a, b) => a.price - b.price);
      else if (sort === "price-desc") events.sort((a, b) => b.price - a.price);
      else if (sort === "popularity") events.sort((a, b) => b.votes - a.votes);
    }
    return events;
  },

  async getEventById(id) {
    if (isDbConnected()) {
      const sql = `
        SELECT
          e.id, e.title, e.subtitle, e.description, e.category, e.city, e.venue,
          TO_CHAR(e.event_date, 'YYYY-MM-DD') AS date,
          e.event_time AS time,
          e.duration, e.price, e.max_price AS "maxPrice",
          e.image_url AS image, e.rating, e.votes, e.tags,
          e.cast_members AS cast, e.total_seats AS "totalSeats",
          e.filled_pct AS "filledPct", e.status,
          COALESCE(
            (SELECT COUNT(*) FROM booking_seats bs WHERE bs.event_id = e.id AND bs.reservation_status IN ('HELD', 'CONFIRMED')),
            0
          )::int AS "dynamicallyBookedSeats"
        FROM events e
        WHERE e.id = $1
      `;
      const res = await query(sql, [id]);
      return res.rows[0] || null;
    }

    const events = readJsonEvents();
    const event = events.find((e) => e.id === id);
    if (!event) return null;

    const bookings = readJsonBookings();
    const eventBookings = bookings.filter((b) => b.event?.id === event.id || b.eventId === event.id);
    const dynamicallyBookedSeats = eventBookings.reduce((acc, b) => acc + (b.seats?.length || 0), 0);

    return { ...event, dynamicallyBookedSeats };
  },

  async getEventBookedSeats(id) {
    if (isDbConnected()) {
      const res = await query(
        `SELECT seat_number, reservation_status, tier
         FROM booking_seats
         WHERE event_id = $1 AND reservation_status IN ('HELD', 'CONFIRMED')`,
        [id]
      );
      return res.rows.map((r) => r.seat_number);
    }

    const bookings = readJsonBookings();
    const eventBookings = bookings.filter((b) => b.event?.id === id || b.eventId === id);
    const seats = [];
    eventBookings.forEach((b) => {
      if (Array.isArray(b.seats)) seats.push(...b.seats);
    });
    return seats;
  },

  async upsertEvent(e) {
    if (!isDbConnected()) return null;
    const sql = `
      INSERT INTO events (
        id, title, subtitle, description, category, city, venue,
        event_date, event_time, duration, price, max_price,
        image_url, rating, votes, tags, cast_members,
        total_seats, filled_pct, status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17,
        $18, $19, 'ACTIVE', NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        subtitle = EXCLUDED.subtitle,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        city = EXCLUDED.city,
        venue = EXCLUDED.venue,
        event_date = EXCLUDED.event_date,
        event_time = EXCLUDED.event_time,
        duration = EXCLUDED.duration,
        price = EXCLUDED.price,
        max_price = EXCLUDED.max_price,
        image_url = EXCLUDED.image_url,
        rating = EXCLUDED.rating,
        votes = EXCLUDED.votes,
        tags = EXCLUDED.tags,
        cast_members = EXCLUDED.cast_members,
        total_seats = EXCLUDED.total_seats,
        filled_pct = EXCLUDED.filled_pct,
        updated_at = NOW()
      RETURNING id, title
    `;
    const res = await query(sql, [
      e.id,
      e.title,
      e.subtitle || null,
      e.description || "",
      e.category || "music",
      e.city || "Mumbai",
      e.venue || "Venue",
      e.date,
      e.time || "7:00 PM",
      e.duration || "2h",
      e.price,
      e.maxPrice || null,
      e.image || `/images/events/${e.id}.jpg`,
      e.rating || 4.5,
      e.votes || 0,
      e.tags || [],
      JSON.stringify(e.cast || []),
      e.totalSeats || 1000,
      e.filledPct || 0.5,
    ]);
    return res.rows[0];
  },
};

