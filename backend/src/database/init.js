import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query, testConnection } from "./pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initDatabase() {
  const conn = await testConnection();
  if (!conn.connected) {
    console.warn(`[DATABASE] PostgreSQL connection not established: ${conn.error}`);
    console.warn("[DATABASE] Database schema initialization skipped. Will retry on next request.");
    return false;
  }

  try {
    const schemaPath = path.join(__dirname, "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");

    console.log("[DATABASE] Initializing database schema...");
    await query(schemaSql);
    console.log("[DATABASE] Schema initialized successfully: tables, indexes, and constraints ready.");
    return true;
  } catch (err) {
    console.error("[DATABASE] Error applying schema:", err.message);
    throw err;
  }
}

