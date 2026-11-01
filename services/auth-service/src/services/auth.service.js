import bcrypt from "bcryptjs";
import { userRepo } from "../database/repositories/user.repo.js";
import { config } from "../config/env.config.js";
import { signAccessToken, signRefreshToken } from "../../../../shared/common-utils/jwt.js";
import { createNotification } from "../../../../shared/notification-module/src/services/notification.service.js";
import { sendRegistrationEmail } from "../../../../shared/notification-module/src/services/email.service.js";

const SALT_ROUNDS = 10;

export const authService = {
  async register({ name, phone, email, password }) {
    if (!phone) throw new Error("Phone number is required");
    if (!password) throw new Error("Password is required");

    const digitsOnly = phone.replace(/\D/g, "").slice(-10);
    const formattedPhone = `+91 ${digitsOnly}`;

    const existingByPhone = await userRepo.findByPhone(digitsOnly);
    if (existingByPhone) {
      throw new Error("An account with this phone number already exists");
    }

    if (email) {
      const existingByEmail = await userRepo.findByEmail(email);
      if (existingByEmail) {
        throw new Error("An account with this email address already exists");
      }
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const userId = "usr_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    const user = await userRepo.createUser({
      id: userId,
      name: name || "User",
      email: email || null,
      phone: formattedPhone,
      passwordHash,
      role: "user",
      preferences: { city: "Mumbai", notifications: true },
    });

    const tokenPayload = {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role || "user",
    };
    const accessToken = signAccessToken(tokenPayload, config.jwtSecret, config.jwtAccessExpiresIn);
    const refreshToken = signRefreshToken(tokenPayload, config.jwtSecret, config.jwtRefreshExpiresIn);

    // Asynchronously dispatch welcome in-app notification and email
    createNotification({
      userId: user.id,
      type: "WELCOME",
      title: "Welcome to ShowTime!",
      message: `Hi ${user.name}, your account has been created. Explore live concerts, comedy, and sports events.`,
      data: { userId: user.id, email: user.email },
    }).catch(() => {});

    if (user.email) {
      sendRegistrationEmail({ to: user.email, name: user.name, email: user.email }).catch(() => {});
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role || "user",
        preferences: user.preferences,
      },
      token: accessToken,
      refreshToken,
    };
  },

  async login({ identifier, password }) {
    if (!identifier) throw new Error("Phone number or email is required");
    if (!password) throw new Error("Password is required");

    const user = await userRepo.findByIdentifier(identifier);
    if (!user) {
      throw new Error("No account found with these credentials");
    }

    let isPasswordValid = false;
    if (user.password_hash) {
      if (user.password_hash.startsWith("$2a$") || user.password_hash.startsWith("$2b$")) {
        isPasswordValid = await bcrypt.compare(password, user.password_hash);
      } else {
        isPasswordValid = user.password_hash === password;
      }
    }

    if (!isPasswordValid) {
      throw new Error("Incorrect password. Please try again or use 'Forgot Password'.");
    }

    const tokenPayload = {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role || "user",
    };
    const accessToken = signAccessToken(tokenPayload, config.jwtSecret, config.jwtAccessExpiresIn);
    const refreshToken = signRefreshToken(tokenPayload, config.jwtSecret, config.jwtRefreshExpiresIn);

    // Asynchronously dispatch welcome in-app notification and email
    createNotification({
      userId: user.id,
      type: "WELCOME",
      title: "Welcome to ShowTime!",
      message: `Hi ${user.name}, your account has been created. Explore live concerts, comedy, and sports events.`,
      data: { userId: user.id, email: user.email },
    }).catch(() => {});

    if (user.email) {
      sendRegistrationEmail({ to: user.email, name: user.name, email: user.email }).catch(() => {});
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role || "user",
        preferences: user.preferences,
      },
      token: accessToken,
      refreshToken,
    };
  },

  async resetPassword({ identifier, newPassword }) {
    if (!identifier || !newPassword) {
      throw new Error("Identifier and new password are required");
    }

    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const updated = await userRepo.updatePassword(identifier, newPasswordHash);
    if (!updated) {
      throw new Error("No user found with the provided phone or email");
    }
    return { success: true, message: "Password updated successfully" };
  },

  async changePassword(userId, { currentPassword, newPassword }) {
    if (!userId) throw new Error("User ID is required");
    if (!newPassword || newPassword.length < 6) {
      throw new Error("New password must be at least 6 characters long");
    }

    const user = await userRepo.findById(userId);
    if (!user) throw new Error("User not found");

    // If account has an existing password set, verify current password
    if (user.password_hash) {
      if (!currentPassword) {
        throw new Error("Current password is required");
      }
      let isCurrentValid = false;
      if (user.password_hash.startsWith("$2a$") || user.password_hash.startsWith("$2b$")) {
        isCurrentValid = await bcrypt.compare(currentPassword, user.password_hash);
      } else {
        isCurrentValid = user.password_hash === currentPassword;
      }
      if (!isCurrentValid) {
        throw new Error("Current password does not match");
      }
    }

    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const updated = await userRepo.updatePasswordById(userId, newPasswordHash);
    if (!updated) {
      throw new Error("Failed to update password");
    }

    // In-app security notification
    createNotification({
      userId: user.id,
      type: "SECURITY",
      title: "Password Updated Successfully",
      message: `Your ShowTime account password was changed on ${new Date().toLocaleDateString("en-IN")}. If this was not you, please secure your account immediately.`,
      data: { userId: user.id },
    }).catch(() => {});

    return { success: true, message: "Password updated successfully" };
  },

  async updateProfile(userId, { name, email, preferences }) {
    if (!userId) throw new Error("User ID is required");
    const updated = await userRepo.updateProfile(userId, { name, email, preferences });
    if (!updated) throw new Error("User not found");
    return updated;
  },

  async deleteAccount(userId, phone, email) {
    const deleted = await userRepo.deleteAccount(userId, phone, email);
    if (!deleted) throw new Error("Account not found or already deleted");
    return { success: true, message: "Account deleted successfully" };
  },

  async googleLogin({ email, name, googleId, idToken, photoUrl }) {
    if (!email) throw new Error("Google email address is required");
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.includes("@")) throw new Error("A valid email address is required");

    let user = await userRepo.findByEmail(cleanEmail);
    if (!user) {
      // Auto-register new Google user
      const userId = "usr_g_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const generatedPhone = "+91 9" + Math.floor(100000000 + Math.random() * 900000000).toString().slice(0, 9);
      const passwordHash = await bcrypt.hash("google_oauth_" + Date.now() + Math.random(), SALT_ROUNDS);

      user = await userRepo.createUser({
        id: userId,
        name: name || cleanEmail.split("@")[0],
        email: cleanEmail,
        phone: generatedPhone,
        passwordHash,
        role: "user",
        preferences: { city: "Mumbai", notifications: true, authProvider: "google" },
      });

      createNotification({
        userId: user.id,
        type: "WELCOME",
        title: "Welcome to ShowTime!",
        message: `Hi ${user.name}, your account has been connected with Google (${cleanEmail}).`,
        data: { userId: user.id, email: user.email },
      }).catch(() => {});
    }

    const tokenPayload = {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role || "user",
    };
    const accessToken = signAccessToken(tokenPayload, config.jwtSecret, config.jwtAccessExpiresIn);
    const refreshToken = signRefreshToken(tokenPayload, config.jwtSecret, config.jwtRefreshExpiresIn);

    return {
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role || "user",
        preferences: user.preferences,
      },
      token: accessToken,
      refreshToken,
    };
  },

  async loginOrRegisterOtpUser(target) {
    let user = await userRepo.findByIdentifier(target);
    if (!user) {
      const isEmail = target.includes("@");
      const userId = "usr_otp_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const passwordHash = await bcrypt.hash("otp_login_" + Date.now(), SALT_ROUNDS);
      const phone = isEmail
        ? "+91 9" + Math.floor(100000000 + Math.random() * 900000000).toString().slice(0, 9)
        : `+91 ${target.replace(/\D/g, "").slice(-10)}`;
      const email = isEmail ? target.trim().toLowerCase() : null;
      const name = isEmail ? target.split("@")[0] : `User ${target.replace(/\D/g, "").slice(-4)}`;

      user = await userRepo.createUser({
        id: userId,
        name,
        email,
        phone,
        passwordHash,
        role: "user",
        preferences: { city: "Mumbai", notifications: true },
      });
    }

    const tokenPayload = {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role || "user",
    };
    const accessToken = signAccessToken(tokenPayload, config.jwtSecret, config.jwtAccessExpiresIn);
    const refreshToken = signRefreshToken(tokenPayload, config.jwtSecret, config.jwtRefreshExpiresIn);

    return {
      verified: true,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role || "user",
        preferences: user.preferences,
      },
      token: accessToken,
      refreshToken,
    };
  },
};

