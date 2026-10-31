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
    ssl: (process.env.DATABASE_SSL === "true" || (config.databaseUrl && config.databaseUrl.includes("sslmode=require"))) ? { rejectUnauthorized: false } : false,
  });

  pool.on("error", (err) => {
    console.error("[Event-Service Database] Unexpected pool error:", err.message);
    dbConnected = false;
  });

  pool.query("SELECT 1")
    .then(() => {
      dbConnected = true;
      console.log("[Event-Service Database] PostgreSQL connected (event_schema)");
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

