import pg from "pg";
import { config } from "../config/env.config.js";

const { Pool } = pg;

let pool = null;
let isConnected = false;

export function getPool() {
  if (!pool) {
    const isRds = config.db.url.includes("rds.amazonaws.com") || config.isProduction;

    pool = new Pool({
      connectionString: config.db.url,
      max: config.db.poolMax,
      min: config.db.poolMin,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: config.db.timeoutMs,
      ssl: isRds ? { rejectUnauthorized: false } : false,
    });

    pool.on("error", (err) => {
      console.error("[DATABASE] Unexpected error on idle PostgreSQL client:", err.message);
      isConnected = false;
    });
  }
  return pool;
}

export async function testConnection() {
  try {
    const currentPool = getPool();
    const client = await currentPool.connect();
    try {
      await client.query("SELECT 1");
      isConnected = true;
      return { connected: true, message: "PostgreSQL connected successfully" };
    } finally {
      client.release();
    }
  } catch (err) {
    isConnected = false;
    return { connected: false, error: err.message };
  }
}

export function isDbConnected() {
  return isConnected;
}

export async function query(text, params = []) {
  const currentPool = getPool();
  const start = Date.now();
  try {
    const res = await currentPool.query(text, params);
    const duration = Date.now() - start;
    if (config.isDevelopment && duration > 200) {
      console.warn(`[DATABASE] Slow query (${duration}ms):`, text.slice(0, 80));
    }
    return res;
  } catch (err) {
    console.error("[DATABASE] Query execution failed:", {
      query: text.slice(0, 120),
      error: err.message,
    });
    throw err;
  }
}

/**
 * Execute a sequence of queries within an atomic database transaction.
 * Automatically performs BEGIN, COMMIT, or ROLLBACK upon error.
 *
 * @param {Function} callback - Function receiving the connected client
 */
export async function withTransaction(callback) {
  const currentPool = getPool();
  const client = await currentPool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (pool) {
    console.log("[DATABASE] Closing PostgreSQL connection pool...");
    await pool.end();
    pool = null;
    isConnected = false;
  }
}

