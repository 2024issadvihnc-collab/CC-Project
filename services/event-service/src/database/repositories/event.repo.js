import { query, isDbConnected } from "../pool.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "../../config/env.config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JSON_EVENTS_FILE = path.join(__dirname, "../../../../../backend/data/events.json");
const JSON_BOOKINGS_FILE = path.join(__dirname, "../../../../../backend/data/bookings.json");

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

      if (city && city !== "All" && city !== "All Cities") {
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

    // Fallback to JSON data if DB is offline during local dev
    let events = readJsonEvents();
    if (category && category !== "all") {
      events = events.filter((e) => e.category === category);
    }
    if (city && city !== "All" && city !== "All Cities") {
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
          e.filled_pct AS "filledPct", e.status
        FROM events e
        WHERE e.id = $1
      `;
      const res = await query(sql, [id]);
      return res.rows[0] || null;
    }

    const events = readJsonEvents();
    const event = events.find((e) => e.id === id);
    return event || null;
  },

  async getEventBookedSeats(id) {
    // Inter-service call to Booking Service to get active reserved seats
    try {
      const res = await fetch(`${config.bookingServiceUrl}/api/bookings/events/${id}/seats`, {
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) {
        const body = await res.json();
        if (body.data && Array.isArray(body.data.bookedSeats)) {
          return body.data.bookedSeats;
        }
      }
    } catch (_) {}

    // Fallback: check bookings.json
    const bookings = readJsonBookings();
    const eventBookings = bookings.filter((b) => b.event?.id === id || b.eventId === id);
    const seats = [];
    eventBookings.forEach((b) => {
      if (Array.isArray(b.seats)) seats.push(...b.seats);
    });
    return seats;
  },

  async createEvent(eventData) {
    if (isDbConnected()) {
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
        RETURNING id, title, price, city, category
      `;
      const res = await query(sql, [
        eventData.id,
        eventData.title,
        eventData.subtitle || null,
        eventData.description || "",
        eventData.category || "music",
        eventData.city || "Mumbai",
        eventData.venue || "TBD",
        eventData.date || new Date().toISOString().split("T")[0],
        eventData.time || "19:00",
        eventData.duration || "2h",
        eventData.price || 500,
        eventData.maxPrice || eventData.price || 500,
        eventData.image || null,
        eventData.rating || 4.5,
        eventData.votes || 0,
        eventData.tags || [],
        JSON.stringify(eventData.cast || []),
        eventData.totalSeats || 1000,
        eventData.filledPct || 0.0,
      ]);
      return res.rows[0];
    }

    const events = readJsonEvents();
    events.push(eventData);
    try {
      fs.writeFileSync(JSON_EVENTS_FILE, JSON.stringify(events, null, 2), "utf-8");
    } catch (_) {}
    return eventData;
  },

  async deleteEvent(id) {
    if (isDbConnected()) {
      const res = await query("DELETE FROM events WHERE id = $1 RETURNING id", [id]);
      return res.rowCount > 0;
    }
    const events = readJsonEvents();
    const filtered = events.filter((e) => e.id !== id);
    try {
      fs.writeFileSync(JSON_EVENTS_FILE, JSON.stringify(filtered, null, 2), "utf-8");
    } catch (_) {}
    return filtered.length < events.length;
  },
};

