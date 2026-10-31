import { authService } from "../services/auth.service.js";
import { otpService } from "../services/otp.service.js";

export const authController = {
  async register(req, res, next) {
    try {
      const { name, phone, email, password } = req.body;
      const result = await authService.register({ name, phone, email, password });
      res.status(201).json({
        success: true,
        message: "Registration successful. Welcome to ShowTime.",
        user: result.user,
        token: result.token,
      });
    } catch (err) {
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      const { identifier, password } = req.body;
      const result = await authService.login({ identifier, password });
      res.json({
        success: true,
        message: "Welcome back.",
        user: result.user,
        token: result.token,
      });
    } catch (err) {
      next(err);
    }
  },

  async resetPassword(req, res, next) {
    try {
      const { identifier, newPassword } = req.body;
      await authService.resetPassword({ identifier, newPassword });
      res.json({
        success: true,
        message: "Password reset successfully. You can now log in with your new password.",
      });
    } catch (err) {
      next(err);
    }
  },

  async sendOtp(req, res, next) {
    try {
      const { phone } = req.body;
      const result = await otpService.sendOtp(phone);
      res.json({
        success: true,
        message: `OTP sent successfully to ${result.phone}`,
        phone: result.phone,
        otp: result.demoCode || "OTP sent via SMS",
      });
    } catch (err) {
      next(err);
    }
  },

  async verifyOtp(req, res, next) {
    try {
      const { phone, otp } = req.body;
      await otpService.verifyOtp(phone, otp);

      // Authenticate or create user session
      const cleanPhone = phone.replace(/\D/g, "").slice(-10);
      const formattedPhone = `+91 ${cleanPhone}`;

      let user;
      try {
        const existing = await authService.login({
          identifier: cleanPhone,
          password: "OTP_AUTH_VERIFIED",
        });
        user = existing.user;
      } catch (_) {
        // If not existing, register a lightweight user
        try {
          const registered = await authService.register({
            name: "ShowTime User",
            phone: formattedPhone,
            email: `${cleanPhone}@showtime.in`,
            password: "User@" + cleanPhone.slice(-4),
          });
          user = registered.user;
        } catch (_) {
          // If already exists under that email/phone, fetch directly
          const { userRepo } = await import("../database/repositories/user.repo.js");
          user = await userRepo.findByPhone(cleanPhone);
        }
      }

      const token = authService.generateToken(user);
      const { password_hash: _, password: __, ...safeUser } = user;

      res.json({
        success: true,
        message: "Logged in successfully",
        user: safeUser,
        token,
      });
    } catch (err) {
      next(err);
    }
  },

  async updateProfile(req, res, next) {
    try {
      const { id, name, email, phone, city, preferences } = req.body;
      const targetId = req.user?.id || id;

      if (!targetId && !phone && !email) {
        return res.status(400).json({ error: "User identifier required" });
      }

      const { userRepo } = await import("../database/repositories/user.repo.js");
      let user = targetId ? await userRepo.findById(targetId) : null;
      if (!user && (phone || email)) {
        user = await userRepo.findByIdentifier(phone || email);
      }

      if (!user) {
        return res.status(404).json({ error: "User profile not found" });
      }

      const updated = await authService.updateProfile(user.id, {
        name,
        email,
        phone,
        preferences: {
          ...(user.preferences || {}),
          ...(preferences || {}),
          city: city || user.preferences?.city || "Mumbai",
        },
      });

      res.json({
        success: true,
        message: "Profile updated successfully.",
        user: updated,
      });
    } catch (err) {
      next(err);
    }
  },

  async deleteAccount(req, res, next) {
    try {
      const { userId, phone, email } = req.body;
      const targetId = req.user?.id || userId;

      const { userRepo } = await import("../database/repositories/user.repo.js");
      let user = targetId ? await userRepo.findById(targetId) : null;
      if (!user && (phone || email)) {
        user = await userRepo.findByIdentifier(phone || email);
      }

      if (!user) {
        return res.status(404).json({ error: "Account not found or already deleted." });
      }

      await authService.deleteAccount(user.id);
      res.json({
        success: true,
        message: "Your account and personal data have been deleted successfully.",
      });
    } catch (err) {
      next(err);
    }
  },
};

