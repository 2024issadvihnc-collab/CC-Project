import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config/env.config.js";
import { userRepo } from "../database/repositories/user.repo.js";

export class AuthError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export const authService = {
  generateToken(user) {
    const payload = {
      id: user.id,
      name: user.name,
      email: user.email || null,
      phone: user.phone || null,
    };
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });
  },

  async register({ name, phone, email, password }) {
    if (!name || !name.trim()) {
      throw new AuthError("Full Name is required", 400);
    }
    const cleanPhone = phone ? phone.replace(/\D/g, "").slice(-10) : "";
    if (cleanPhone.length < 10) {
      throw new AuthError("Valid 10-digit mobile number is required", 400);
    }
    const cleanEmail = email ? email.trim().toLowerCase() : "";
    if (!cleanEmail || !cleanEmail.includes("@")) {
      throw new AuthError("Valid email address is required", 400);
    }
    if (!password || password.length < 4) {
      throw new AuthError("Password must be at least 4 characters long", 400);
    }

    const existingEmail = await userRepo.findByEmail(cleanEmail);
    if (existingEmail) {
      throw new AuthError("An account with this email already exists. Please sign in.", 409);
    }

    const formattedPhone = `+91 ${cleanPhone}`;
    const existingPhone = await userRepo.findByPhone(cleanPhone);
    if (existingPhone) {
      throw new AuthError("An account with this mobile number already exists. Please sign in.", 409);
    }

    const passwordHash = await bcrypt.hash(password, config.security.bcryptSaltRounds);
    const userId = "u_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    const newUser = await userRepo.createUser({
      id: userId,
      name: name.trim(),
      email: cleanEmail,
      phone: formattedPhone,
      passwordHash,
      preferences: { city: "Mumbai", notifications: true },
    });

    const token = this.generateToken(newUser);
    const { password_hash: _, ...safeUser } = newUser;

    console.log(`[AUTH] Successfully registered new user: ${safeUser.name} (${safeUser.email})`);

    return {
      user: safeUser,
      token,
    };
  },

  async login({ identifier, password }) {
    if (!identifier || !password) {
      throw new AuthError("Phone/Email and Password are required", 400);
    }

    const user = await userRepo.findByIdentifier(identifier);
    if (!user) {
      throw new AuthError("No account found with this phone or email. Please register first.", 404);
    }

    // Support both bcrypt hashes and legacy plain-text passwords
    let passwordMatch = false;
    const isBcryptHash = user.password_hash && user.password_hash.startsWith("$2");

    if (isBcryptHash) {
      passwordMatch = await bcrypt.compare(password, user.password_hash);
    } else if (user.password_hash) {
      // Legacy match
      passwordMatch = user.password_hash === password;
      // Upgrade legacy password to bcrypt hash in background
      if (passwordMatch) {
        bcrypt.hash(password, config.security.bcryptSaltRounds).then((hash) => {
          userRepo.updatePassword(user.id, hash).catch(() => {});
        });
      }
    }

    if (!passwordMatch) {
      throw new AuthError("Incorrect password. Please try again.", 401);
    }

    const token = this.generateToken(user);
    const { password_hash: _, password: __, ...safeUser } = user;

    console.log(`[AUTH] User authenticated: ${safeUser.name || safeUser.phone}`);

    return {
      user: safeUser,
      token,
    };
  },

  async resetPassword({ identifier, newPassword }) {
    if (!identifier || !newPassword) {
      throw new AuthError("Phone/Email and new password are required", 400);
    }
    if (newPassword.length < 4) {
      throw new AuthError("New password must be at least 4 characters long", 400);
    }

    const user = await userRepo.findByIdentifier(identifier);
    if (!user) {
      throw new AuthError("No account found matching this phone number or email.", 404);
    }

    const passwordHash = await bcrypt.hash(newPassword, config.security.bcryptSaltRounds);
    await userRepo.updatePassword(user.id, passwordHash);

    console.log(`[AUTH] Password reset completed for user ID: ${user.id}`);
    return { success: true };
  },

  async updateProfile(userId, profileData) {
    const updated = await userRepo.updateProfile(userId, profileData);
    if (!updated) {
      throw new AuthError("User profile not found", 404);
    }
    const { password_hash: _, password: __, ...safeUser } = updated;
    return safeUser;
  },

  async deleteAccount(userId) {
    const deleted = await userRepo.deleteUser(userId);
    if (!deleted) {
      throw new AuthError("Account not found or already deleted", 404);
    }
    return { success: true };
  },
};

