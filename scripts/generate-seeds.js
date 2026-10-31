import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");

const eventsFile = path.join(ROOT, "backend/data/events.json");
const events = JSON.parse(fs.readFileSync(eventsFile, "utf-8"));

function escapeSql(str) {
  if (typeof str !== "string") return "";
  return str.replace(/'/g, "''");
}

let sql = `
-- =============================================================================
-- SEED DATA FOR EVENT SERVICE & AUTH SERVICE (Auto-initialized on start)
-- =============================================================================

-- Seed Admin and Demo User (Password: "Demo@12345" and "Admin@12345")
INSERT INTO auth_schema.users (id, name, email, phone, password_hash, role, preferences)
VALUES
  ('usr_admin_01', 'ShowTime Admin', 'admin@showtime.local', '+91 9999900000', '$2a$10$wT8hTqL3XvXwYV8qW7iY.ObZk4bE1Y5Yt8lG9wG3r4t5y6u7i8o9p', 'admin', '{"city": "Mumbai", "notifications": true}'::jsonb),
  ('usr_demo_01', 'Demo Customer', 'customer@showtime.local', '+91 9800012345', '$2a$10$wT8hTqL3XvXwYV8qW7iY.ObZk4bE1Y5Yt8lG9wG3r4t5y6u7i8o9p', 'user', '{"city": "Mumbai", "notifications": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Seed 16 Real-World Events
`;

for (const e of events) {
  const tagsArray = (e.tags || []).map((t) => `'${escapeSql(t)}'`).join(", ");
  const tagsSql = tagsArray ? `ARRAY[${tagsArray}]` : "ARRAY[]::text[]";
  const castJson = JSON.stringify(e.cast || []).replace(/'/g, "''");

  sql += `
INSERT INTO event_schema.events (
  id, title, subtitle, description, category, city, venue,
  event_date, event_time, duration, price, max_price,
  image_url, rating, votes, tags, cast_members, total_seats, filled_pct, status
) VALUES (
  '${e.id}', '${escapeSql(e.title)}', '${escapeSql(e.subtitle || "")}', '${escapeSql(e.description || "")}',
  '${e.category}', '${escapeSql(e.city)}', '${escapeSql(e.venue)}',
  '${e.date}', '${e.time}', '${escapeSql(e.duration || "2h")}', ${e.price}, ${e.maxPrice || e.price},
  '${escapeSql(e.image || "")}', ${e.rating || 4.5}, ${e.votes || 0}, ${tagsSql}, '${castJson}'::jsonb,
  ${e.totalSeats || 1000}, ${e.filledPct || 0.0}, 'ACTIVE'
) ON CONFLICT (id) DO NOTHING;
`;
}

const outputFile = path.join(ROOT, "infrastructure/database/seeds.sql");
fs.writeFileSync(outputFile, sql, "utf-8");
console.log(`Successfully generated ${events.length} event seed SQL statements into ${outputFile}`);

