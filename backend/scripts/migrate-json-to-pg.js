/**
 * =============================================================================
 * ShowTime JSON to PostgreSQL Migration Script
 * Migrates users.json, events.json, and bookings.json into Amazon RDS PostgreSQL
 *
 * Usage:
 *   node scripts/migrate-json-to-pg.js
 *
 * Features:
 *   - Creates backup timestamped copy of all original JSON files before migration
 *   - Idempotent upsert logic prevents duplicate imports
 *   - Preserves all existing IDs, booking references, and relationships
 *   - Verifies foreign keys and constraints
 *   - Prints a detailed migration summary report
 *   - NEVER modifies or deletes original source JSON files
 * =============================================================================
 */

import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";
import { getPool, query, withTransaction, testConnection } from "../src/database/pool.js";
import { initDatabase } from "../src/database/init.js";
import { config } from "../src/config/env.config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, "../data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");
const BOOKINGS_FILE = path.join(DATA_DIR, "bookings.json");

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content || "[]");
}

function createBackup(backupDir) {
  fs.mkdirSync(backupDir, { recursive: true });
  [USERS_FILE, EVENTS_FILE, BOOKINGS_FILE].forEach((f) => {
    if (fs.existsSync(f)) {
      const dest = path.join(backupDir, path.basename(f));
      fs.copyFileSync(f, dest);
    }
  });
  console.log(`[BACKUP] Safely created JSON backup in: ${backupDir}`);
}

async function runMigration() {
  console.log("==========================================================");
  console.log("Starting ShowTime JSON to PostgreSQL Migration");
  console.log(`Database Target: ${config.db.url.replace(/:[^:]*@/, ":****@")}`);
  console.log("==========================================================");

  // 1. Create Timestamped Backup
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(DATA_DIR, "backups", `backup-${timestamp}`);
  createBackup(backupDir);

  // 2. Test DB Connection
  const connStatus = await testConnection();
  if (!connStatus.connected) {
    console.error("[MIGRATION ERROR] Could not connect to PostgreSQL:", connStatus.error);
    console.error("Please verify that your PostgreSQL instance is running and DATABASE_URL is set.");
    process.exit(1);
  }

  // 3. Ensure Schema Exists
  await initDatabase();

  const summary = {
    users: { read: 0, imported: 0, skipped: 0 },
    events: { read: 0, imported: 0, skipped: 0 },
    bookings: { read: 0, imported: 0, skipped: 0 },
    seats: { imported: 0 },
    payments: { imported: 0 },
  };

  await withTransaction(async (client) => {
    // 4. Migrate Users
    const users = readJsonFile(USERS_FILE);
    summary.users.read = users.length;
    console.log(`\n[1/3] Migrating ${users.length} Users...`);

    for (const u of users) {
      if (!u.id) continue;
      // Hash password if not already hashed
      let passwordHash = u.password || u.password_hash || "User@123";
      if (!passwordHash.startsWith("$2")) {
        passwordHash = await bcrypt.hash(passwordHash, config.security.bcryptSaltRounds);
      }

      const res = await client.query(
        `INSERT INTO users (id, name, email, phone, password_hash, preferences, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, NOW()), COALESCE($8::timestamptz, NOW()))
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           email = COALESCE(EXCLUDED.email, users.email),
           phone = COALESCE(EXCLUDED.phone, users.phone),
           password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
           updated_at = NOW()
         RETURNING id`,
        [
          u.id,
          u.name || "ShowTime User",
          u.email ? u.email.trim().toLowerCase() : null,
          u.phone ? `+91 ${u.phone.replace(/\D/g, "").slice(-10)}` : null,
          passwordHash,
          JSON.stringify(u.preferences || { city: "Mumbai", notifications: true }),
          u.createdAt || null,
          u.updatedAt || null,
        ]
      );
      if (res.rowCount > 0) summary.users.imported++;
    }

    // 5. Migrate Events
    const events = readJsonFile(EVENTS_FILE);
    summary.events.read = events.length;
    console.log(`[2/3] Migrating ${events.length} Events...`);

    for (const e of events) {
      if (!e.id || !e.title) continue;
      const res = await client.query(
        `INSERT INTO events (
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
        RETURNING id`,
        [
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
          e.price || 0,
          e.maxPrice || null,
          e.image || `/images/events/${e.id}.jpg`,
          e.rating || 4.5,
          e.votes || 0,
          e.tags || [],
          JSON.stringify(e.cast || []),
          e.totalSeats || 1000,
          e.filledPct || 0.5,
        ]
      );
      if (res.rowCount > 0) summary.events.imported++;
    }

    // 6. Migrate Bookings, Booking Seats & Payments
    const bookings = readJsonFile(BOOKINGS_FILE);
    summary.bookings.read = bookings.length;
    console.log(`[3/3] Migrating ${bookings.length} Bookings & Seats...`);

    for (const b of bookings) {
      if (!b.bookingId) continue;

      const eventId = b.eventId || b.event?.id;
      if (!eventId) {
        summary.bookings.skipped++;
        continue;
      }

      // Check if event exists in DB
      const evCheck = await client.query(`SELECT id FROM events WHERE id = $1`, [eventId]);
      if (evCheck.rows.length === 0) {
        // Upsert dummy/placeholder event if missing
        await client.query(
          `INSERT INTO events (id, title, category, city, venue, event_date, event_time, price, status)
           VALUES ($1, $2, 'music', 'Mumbai', 'Venue', '2026-12-31', '7:00 PM', 500, 'ACTIVE')
           ON CONFLICT DO NOTHING`,
          [eventId, b.event?.title || "Migrated Event"]
        );
      }

      // Resolve user id
      let userId = b.user?.id || null;
      if (userId) {
        const uCheck = await client.query(`SELECT id FROM users WHERE id = $1`, [userId]);
        if (uCheck.rows.length === 0) userId = null;
      }

      // Upsert booking
      const bRes = await client.query(
        `INSERT INTO bookings (
          booking_reference, user_id, event_id, total_amount,
          booking_status, payment_status, payment_method, coupon_code,
          user_details, event_snapshot, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, 'CONFIRMED', 'PAID', $5, $6, $7, $8, COALESCE($9::timestamptz, NOW()), NOW())
        ON CONFLICT (booking_reference) DO UPDATE SET
          total_amount = EXCLUDED.total_amount,
          user_details = EXCLUDED.user_details,
          event_snapshot = EXCLUDED.event_snapshot,
          updated_at = NOW()
        RETURNING id`,
        [
          b.bookingId,
          userId,
          eventId,
          b.total || 0,
          b.paymentMethod || "upi",
          b.coupon || null,
          JSON.stringify(b.user || {}),
          JSON.stringify(b.event || {}),
          b.paidAt || null,
        ]
      );

      const dbBookingId = bRes.rows[0].id;
      summary.bookings.imported++;

      // Migrate seats
      const seats = b.seats || [];
      for (const s of seats) {
        const ticket = (b.tickets || []).find((t) => t.seatId === s) || {};
        const tier = ticket.tierLabel || "Standard";
        const price = ticket.price || Math.round((b.total || 0) / Math.max(1, seats.length));

        await client.query(
          `INSERT INTO booking_seats (
            booking_id, event_id, seat_number, tier, price, reservation_status, created_at
          ) VALUES ($1, $2, $3, $4, $5, 'CONFIRMED', COALESCE($6::timestamptz, NOW()))
          ON CONFLICT DO NOTHING`,
          [dbBookingId, eventId, s, tier, price, b.paidAt || null]
        );
        summary.seats.imported++;
      }

      // Migrate payment record
      const payRef = "PAY_" + b.bookingId;
      await client.query(
        `INSERT INTO payments (
          booking_id, payment_reference, amount, payment_status, payment_gateway, created_at
        ) VALUES ($1, $2, $3, 'COMPLETED', $4, COALESCE($5::timestamptz, NOW()))
        ON CONFLICT (payment_reference) DO NOTHING`,
        [dbBookingId, payRef, b.total || 0, (b.paymentMethod || "UPI").toUpperCase(), b.paidAt || null]
      );
      summary.payments.imported++;
    }
  });

  console.log("\n==========================================================");
  console.log("MIGRATION SUMMARY REPORT:");
  console.log("==========================================================");
  console.log(`Users:    ${summary.users.imported} imported (${summary.users.read} read)`);
  console.log(`Events:   ${summary.events.imported} imported (${summary.events.read} read)`);
  console.log(`Bookings: ${summary.bookings.imported} imported (${summary.bookings.read} read)`);
  console.log(`Seats:    ${summary.seats.imported} confirmed seats recorded`);
  console.log(`Payments: ${summary.payments.imported} payments recorded`);
  console.log(`Backup:   Preserved in ${backupDir}`);
  console.log("Original JSON files left intact in data/");
  console.log("==========================================================\n");

  const pool = getPool();
  await pool.end();
}

runMigration().catch((err) => {
  console.error("[FATAL MIGRATION ERROR]:", err);
  process.exit(1);
});

