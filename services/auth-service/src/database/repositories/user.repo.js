import { query, isDbConnected } from "../pool.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JSON_FALLBACK_FILE = path.join(__dirname, "../../../../../backend/data/users.json");

function readJsonFallback() {
  try {
    if (fs.existsSync(JSON_FALLBACK_FILE)) {
      return JSON.parse(fs.readFileSync(JSON_FALLBACK_FILE, "utf-8") || "[]");
    }
  } catch (_) {}
  return [];
}

function writeJsonFallback(data) {
  try {
    fs.writeFileSync(JSON_FALLBACK_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (_) {}
}

export const userRepo = {
  async findById(id) {
    if (isDbConnected()) {
      const res = await query(
        `SELECT id, name, email, phone, password_hash, role, preferences, created_at, updated_at
         FROM users WHERE id = $1`,
        [id]
      );
      return res.rows[0] || null;
    }
    const users = readJsonFallback();
    const u = users.find((x) => x.id === id);
    return u ? { ...u, password_hash: u.password } : null;
  },

  async findByEmail(email) {
    if (!email) return null;
    const cleanEmail = email.trim().toLowerCase();
    if (isDbConnected()) {
      const res = await query(
        `SELECT id, name, email, phone, password_hash, role, preferences, created_at, updated_at
         FROM users WHERE LOWER(email) = $1`,
        [cleanEmail]
      );
      return res.rows[0] || null;
    }
    const users = readJsonFallback();
    const u = users.find((x) => x.email && x.email.toLowerCase() === cleanEmail);
    return u ? { ...u, password_hash: u.password } : null;
  },

  async findByPhone(phone) {
    if (!phone) return null;
    const digitsOnly = phone.replace(/\D/g, "").slice(-10);
    if (isDbConnected()) {
      const res = await query(
        `SELECT id, name, email, phone, password_hash, role, preferences, created_at, updated_at
         FROM users WHERE phone = $1 OR RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = $2`,
        [`+91 ${digitsOnly}`, digitsOnly]
      );
      return res.rows[0] || null;
    }
    const users = readJsonFallback();
    const u = users.find(
      (x) => x.phone && x.phone.replace(/\D/g, "").slice(-10) === digitsOnly
    );
    return u ? { ...u, password_hash: u.password } : null;
  },

  async findByIdentifier(identifier) {
    if (!identifier) return null;
    const clean = identifier.trim().toLowerCase();
    const digitsOnly = identifier.replace(/\D/g, "").slice(-10);

    if (isDbConnected()) {
      const res = await query(
        `SELECT id, name, email, phone, password_hash, role, preferences, created_at, updated_at
         FROM users
         WHERE LOWER(email) = $1
            OR phone = $2
            OR (LENGTH($3) >= 10 AND RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = $3)
         LIMIT 1`,
        [clean, `+91 ${digitsOnly}`, digitsOnly]
      );
      return res.rows[0] || null;
    }

    const users = readJsonFallback();
    const u = users.find((x) => {
      const matchEmail = x.email && x.email.toLowerCase() === clean;
      const matchPhone =
        x.phone &&
        (x.phone === clean || x.phone.replace(/\D/g, "").slice(-10) === digitsOnly);
      return matchEmail || matchPhone;
    });
    return u ? { ...u, password_hash: u.password } : null;
  },

  async createUser({ id, name, email, phone, passwordHash, role = "user", preferences = {} }) {
    if (isDbConnected()) {
      const res = await query(
        `INSERT INTO users (id, name, email, phone, password_hash, role, preferences, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING id, name, email, phone, role, preferences, created_at`,
        [id, name, email ? email.toLowerCase() : null, phone, passwordHash, role, JSON.stringify(preferences)]
      );
      return res.rows[0];
    }

    const users = readJsonFallback();
    const newUser = {
      id,
      name,
      email: email ? email.toLowerCase() : "",
      phone,
      password: passwordHash,
      role,
      preferences,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    writeJsonFallback(users);
    return { ...newUser, password_hash: passwordHash };
  },

  async updatePassword(identifier, newPasswordHash) {
    const clean = identifier.trim().toLowerCase();
    const digitsOnly = identifier.replace(/\D/g, "").slice(-10);

    if (isDbConnected()) {
      const res = await query(
        `UPDATE users
         SET password_hash = $1, updated_at = NOW()
         WHERE LOWER(email) = $2
            OR phone = $3
            OR (LENGTH($4) >= 10 AND RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = $4)
            OR id = $2
         RETURNING id, name, email, phone`,
        [newPasswordHash, clean, `+91 ${digitsOnly}`, digitsOnly]
      );
      return res.rows[0] || null;
    }

    const users = readJsonFallback();
    const idx = users.findIndex(
      (x) =>
        x.id === identifier ||
        (x.email && x.email.toLowerCase() === clean) ||
        (x.phone && (x.phone === clean || x.phone.replace(/\D/g, "").slice(-10) === digitsOnly))
    );
    if (idx === -1) return null;
    users[idx].password = newPasswordHash;
    users[idx].updatedAt = new Date().toISOString();
    writeJsonFallback(users);
    return users[idx];
  },

  async updatePasswordById(userId, newPasswordHash) {
    if (isDbConnected()) {
      const res = await query(
        `UPDATE users
         SET password_hash = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, name, email, phone`,
        [newPasswordHash, userId]
      );
      return res.rows[0] || null;
    }

    const users = readJsonFallback();
    const idx = users.findIndex((x) => x.id === userId);
    if (idx === -1) return null;
    users[idx].password = newPasswordHash;
    users[idx].updatedAt = new Date().toISOString();
    writeJsonFallback(users);
    return users[idx];
  },

  async updateProfile(userId, { name, email, preferences }) {
    if (isDbConnected()) {
      const res = await query(
        `UPDATE users
         SET name = COALESCE($2, name),
             email = COALESCE($3, email),
             preferences = COALESCE($4, preferences),
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, name, email, phone, role, preferences, updated_at`,
        [userId, name || null, email ? email.toLowerCase() : null, preferences ? JSON.stringify(preferences) : null]
      );
      return res.rows[0] || null;
    }

    const users = readJsonFallback();
    const idx = users.findIndex((x) => x.id === userId);
    if (idx === -1) return null;
    if (name) users[idx].name = name;
    if (email) users[idx].email = email.toLowerCase();
    if (preferences) users[idx].preferences = { ...(users[idx].preferences || {}), ...preferences };
    writeJsonFallback(users);
    return users[idx];
  },

  async deleteAccount(userId, phone, email) {
    if (isDbConnected()) {
      const res = await query(
        `DELETE FROM users
         WHERE id = $1
            OR (phone IS NOT NULL AND phone = $2)
            OR (email IS NOT NULL AND LOWER(email) = LOWER($3))
         RETURNING id`,
        [userId, phone, email]
      );
      return res.rowCount > 0;
    }

    const users = readJsonFallback();
    const beforeCount = users.length;
    const filtered = users.filter((u) => {
      if (userId && u.id === userId) return false;
      if (phone && u.phone === phone) return false;
      if (email && u.email && u.email.toLowerCase() === email.toLowerCase()) return false;
      return true;
    });
    writeJsonFallback(filtered);
    return filtered.length < beforeCount;
  },
};

