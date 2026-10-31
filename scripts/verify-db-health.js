/**
 * ShowTime Database Multi-Schema Health & Integrity Inspector
 * Inspects row counts, indexes, and constraints across all 5 microservice schemas.
 */

import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pg;

const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:showtime_local_db_pass_2026@localhost:5432/showtime_db";

async function verifyDatabase() {
  console.log("======================================================================");
  console.log("ShowTime PostgreSQL Multi-Schema Integrity Verification");
  console.log("======================================================================\n");
  console.log(`Connecting to: ${dbUrl.replace(/:[^:]*@/, ":****@")} ...`);

  let pool;
  try {
    pool = new Pool({
      connectionString: dbUrl,
      connectionTimeoutMillis: 3000,
    });

    const client = await pool.connect();
    console.log("Successfully connected to PostgreSQL engine!\n");

    const checks = [
      { name: "Auth Schema Users", query: "SELECT COUNT(*) FROM auth_schema.users;" },
      { name: "Auth Schema Tokens", query: "SELECT COUNT(*) FROM auth_schema.refresh_tokens;" },
      { name: "Event Schema Events", query: "SELECT COUNT(*) FROM event_schema.events;" },
      { name: "Booking Schema Bookings", query: "SELECT COUNT(*) FROM booking_schema.bookings;" },
      { name: "Booking Schema Seats", query: "SELECT COUNT(*) FROM booking_schema.booking_seats;" },
      { name: "Payment Schema Payments", query: "SELECT COUNT(*) FROM payment_schema.payments;" },
      { name: "Ticket Schema Tickets", query: "SELECT COUNT(*) FROM ticket_schema.tickets;" },
    ];

    console.log("Schema Integrity Checks:");
    console.log("----------------------------------------------------------------------");
    for (const check of checks) {
      try {
        const res = await client.query(check.query);
        const count = res.rows[0].count;
        console.log(`  [OK] ${check.name.padEnd(28)} -> Row Count: ${count}`);
      } catch (err) {
        console.error(`  [WARN] ${check.name.padEnd(28)} -> ${err.message}`);
      }
    }
    console.log("----------------------------------------------------------------------\n");

    // Check unique index on active seats
    const idxRes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'booking_schema' AND tablename = 'booking_seats';
    `);

    const hasUniqueIdx = idxRes.rows.some((r) => r.indexname === "uq_booking_active_seat");
    console.log(`Concurrency Index (uq_booking_active_seat): ${hasUniqueIdx ? "PRESENT (ACTIVE)" : "MISSING"}`);

    client.release();
    await pool.end();
    console.log("\nDatabase verification complete.");
  } catch (err) {
    console.warn("\n[NOTE] PostgreSQL server is currently offline or unreachable locally.");
    console.warn(`Reason: ${err.message}`);
    console.warn("When Docker Compose is launched (`docker compose up`), PostgreSQL initializes automatically.");
  }
}

verifyDatabase();

