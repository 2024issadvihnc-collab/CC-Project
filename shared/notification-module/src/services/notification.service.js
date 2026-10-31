import pg from "pg";
const { Pool } = pg;

// In-memory fallback repository
const inMemoryNotifications = [];
let nextId = 1;

let pool = null;
let dbConnected = false;

const dbUrl =
  process.env.DATABASE_URL ||
  (process.env.POSTGRES_HOST
    ? `postgresql://${process.env.POSTGRES_USER || "postgres"}:${process.env.POSTGRES_PASSWORD || "showtime_local_db_pass_2026"}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB || "showtime_db"}`
    : "postgresql://postgres:showtime_local_db_pass_2026@localhost:5432/showtime_db");

try {
  pool = new Pool({
    connectionString: dbUrl,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 2000,
    ssl: process.env.NODE_ENV === "production" && !dbUrl.includes("localhost") ? { rejectUnauthorized: false } : false,
  });

  pool.query("SELECT 1")
    .then(async () => {
      dbConnected = true;
      // Auto-create schema and table if not exists
      await pool.query(`
        CREATE SCHEMA IF NOT EXISTS notification_schema;
        CREATE TABLE IF NOT EXISTS notification_schema.notifications (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL,
          type VARCHAR(64) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          data JSONB DEFAULT '{}'::jsonb,
          is_read BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `).catch(() => {});
      console.log("[Notification Service] Connected to PostgreSQL notification_schema");
    })
    .catch(() => {
      dbConnected = false;
      console.log("[Notification Service] Running with in-memory storage (PostgreSQL offline)");
    });
} catch (_) {
  dbConnected = false;
}

export async function createNotification({ userId, type, title, message, data = {} }) {
  if (!userId) {
    console.warn("[Notification Service] Missing userId, notification skipped");
    return null;
  }

  const record = {
    id: nextId++,
    user_id: userId,
    type,
    title,
    message,
    data,
    is_read: false,
    created_at: new Date().toISOString(),
  };

  if (dbConnected && pool) {
    try {
      const res = await pool.query(
        `INSERT INTO notification_schema.notifications (user_id, type, title, message, data, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, FALSE, NOW())
         RETURNING id, user_id, type, title, message, data, is_read, created_at`,
        [userId, type, title, message, JSON.stringify(data)]
      );
      if (res.rows.length > 0) {
        return res.rows[0];
      }
    } catch (err) {
      console.warn("[Notification Service] DB insert failed, falling back to memory:", err.message);
    }
  }

  inMemoryNotifications.unshift(record);
  return record;
}

export async function getUserNotifications(userId, limit = 50) {
  if (dbConnected && pool) {
    try {
      const res = await pool.query(
        `SELECT id, user_id, type, title, message, data, is_read, created_at
         FROM notification_schema.notifications
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit]
      );
      return res.rows;
    } catch (err) {
      console.warn("[Notification Service] DB select failed, returning memory list:", err.message);
    }
  }

  return inMemoryNotifications
    .filter((n) => n.user_id === userId)
    .slice(0, limit);
}

export async function getUnreadCount(userId) {
  if (dbConnected && pool) {
    try {
      const res = await pool.query(
        `SELECT COUNT(*)::int AS unread_count
         FROM notification_schema.notifications
         WHERE user_id = $1 AND is_read = FALSE`,
        [userId]
      );
      return res.rows[0]?.unread_count || 0;
    } catch (err) {
      console.warn("[Notification Service] DB count failed, returning memory count:", err.message);
    }
  }

  return inMemoryNotifications.filter((n) => n.user_id === userId && !n.is_read).length;
}

export async function markAsRead(id, userId) {
  if (dbConnected && pool) {
    try {
      const res = await pool.query(
        `UPDATE notification_schema.notifications
         SET is_read = TRUE
         WHERE id = $1 AND user_id = $2
         RETURNING id, user_id, is_read`,
        [id, userId]
      );
      if (res.rows.length > 0) return res.rows[0];
    } catch (err) {
      console.warn("[Notification Service] DB markAsRead failed:", err.message);
    }
  }

  const notif = inMemoryNotifications.find((n) => String(n.id) === String(id) && n.user_id === userId);
  if (notif) {
    notif.is_read = true;
    return notif;
  }
  return null;
}

export async function markAllAsRead(userId) {
  if (dbConnected && pool) {
    try {
      await pool.query(
        `UPDATE notification_schema.notifications
         SET is_read = TRUE
         WHERE user_id = $1 AND is_read = FALSE`,
        [userId]
      );
      return { success: true };
    } catch (err) {
      console.warn("[Notification Service] DB markAllAsRead failed:", err.message);
    }
  }

  inMemoryNotifications.forEach((n) => {
    if (n.user_id === userId) n.is_read = true;
  });
  return { success: true };
}

