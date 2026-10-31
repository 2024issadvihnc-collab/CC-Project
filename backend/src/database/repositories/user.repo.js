import { query, isDbConnected } from "../pool.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JSON_FALLBACK_FILE = path.join(__dirname, "../../../data/users.json");

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
        `SELECT id, name, email, phone, password_hash, preferences, created_at, updated_at
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
        `SELECT id, name, email, phone, password_hash, preferences, created_at, updated_at
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
        `SELECT id, name, email, phone, password_hash, preferences, created_at, updated_at
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
        `SELECT id, name, email, phone, password_hash, preferences, created_at, updated_at
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

  async createUser({ id, name, email, phone, passwordHash, preferences }) {
    if (isDbConnected()) {
      const res = await query(
        `INSERT INTO users (id, name, email, phone, password_hash, preferences, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING id, name, email, phone, preferences, created_at, updated_at`,
        [id, name, email || null, phone || null, passwordHash || null, JSON.stringify(preferences || {})]
      );
      return res.rows[0];
    }

    const users = readJsonFallback();
    const newUser = {
      id,
      name,
      email: email || "",
      phone: phone || "",
      password: passwordHash,
      preferences: preferences || { city: "Mumbai", notifications: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    users.push(newUser);
    writeJsonFallback(users);
    const { password: _, ...safe } = newUser;
    return safe;
  },

  async updatePassword(id, passwordHash) {
    if (isDbConnected()) {
      const res = await query(
        `UPDATE users
         SET password_hash = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, name, email, phone, updated_at`,
        [passwordHash, id]
      );
      return res.rows[0] || null;
    }

    const users = readJsonFallback();
    const idx = users.findIndex((x) => x.id === id);
    if (idx !== -1) {
      users[idx].password = passwordHash;
      users[idx].updatedAt = new Date().toISOString();
      writeJsonFallback(users);
      return users[idx];
    }
    return null;
  },

  async updateProfile(id, { name, email, phone, preferences }) {
    if (isDbConnected()) {
      const res = await query(
        `UPDATE users
         SET name = COALESCE($1, name),
             email = COALESCE($2, email),
             phone = COALESCE($3, phone),
             preferences = COALESCE($4, preferences),
             updated_at = NOW()
         WHERE id = $5
         RETURNING id, name, email, phone, preferences, created_at, updated_at`,
        [name, email || null, phone || null, preferences ? JSON.stringify(preferences) : null, id]
      );
      return res.rows[0] || null;
    }

    const users = readJsonFallback();
    const idx = users.findIndex((x) => x.id === id);
    if (idx !== -1) {
      if (name) users[idx].name = name;
      if (email) users[idx].email = email;
      if (phone) users[idx].phone = phone;
      if (preferences) users[idx].preferences = { ...users[idx].preferences, ...preferences };
      users[idx].updatedAt = new Date().toISOString();
      writeJsonFallback(users);
      const { password: _, ...safe } = users[idx];
      return safe;
    }
    return null;
  },

  async deleteUser(id) {
    if (isDbConnected()) {
      const res = await query(`DELETE FROM users WHERE id = $1 RETURNING id`, [id]);
      return res.rowCount > 0;
    }
    const users = readJsonFallback();
    const filtered = users.filter((x) => x.id !== id);
    if (filtered.length !== users.length) {
      writeJsonFallback(filtered);
      return true;
    }
    return false;
  },
};

