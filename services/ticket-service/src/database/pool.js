import pg from "pg";
import { config } from "../config/env.config.js";

const { Pool } = pg;

let pool = null;
let dbConnected = false;

try {
  pool = new Pool({
    connectionString: config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 3000,
    ssl: config.nodeEnv === "production" ? { rejectUnauthorized: false } : false,
  });

  pool.on("error", (err) => {
    console.error("[Ticket-Service Database] Unexpected pool error:", err.message);
    dbConnected = false;
  });

  pool.query("SELECT 1")
    .then(() => {
      dbConnected = true;
      console.log("[Ticket-Service Database] PostgreSQL connected (ticket_schema)");
    })
    .catch(() => {
      dbConnected = false;
    });
} catch (_) {
  dbConnected = false;
}

export async function query(text, params) {
  if (!pool) throw new Error("Database pool not initialized");
  return pool.query(text, params);
}

export function isDbConnected() {
  return dbConnected;
}

export async function closePool() {
  if (pool) await pool.end();
}

