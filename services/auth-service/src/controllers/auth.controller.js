import { authService } from "../services/auth.service.js";
import { otpService } from "../services/otp.service.js";
import { sendSuccess, sendError } from "../../../../shared/common-utils/response.js";

export const authController = {
  async register(req, res) {
    try {
      const { name, phone, email, password } = req.body;
      const result = await authService.register({ name, phone, email, password });
      return sendSuccess(res, result, "Registered successfully", 201);
    } catch (err) {
      return sendError(res, err, 400);
    }
  },

  async login(req, res) {
    try {
      const { identifier, password } = req.body;
      const result = await authService.login({ identifier, password });
      return sendSuccess(res, result, "Logged in successfully", 200);
    } catch (err) {
      return sendError(res, err, 401);
    }
  },

  async sendOtp(req, res) {
    try {
      const { phone } = req.body;
      if (!phone) return sendError(res, new Error("Phone number is required"), 400);
      const result = await otpService.generateAndSaveOtp(phone);
      return sendSuccess(res, result, "OTP sent successfully");
    } catch (err) {
      return sendError(res, err, 400);
    }
  },

  async verifyOtp(req, res) {
    try {
      const { phone, otp } = req.body;
      const result = await otpService.verifyOtp(phone, otp);
      if (!result.valid) {
        return sendError(res, new Error(result.reason || "Invalid OTP"), 400);
      }
      return sendSuccess(res, { verified: true }, "OTP verified successfully");
    } catch (err) {
      return sendError(res, err, 400);
    }
  },

  async resetPassword(req, res) {
    try {
      const { identifier, newPassword } = req.body;
      const result = await authService.resetPassword({ identifier, newPassword });
      return sendSuccess(res, result, "Password reset successfully");
    } catch (err) {
      return sendError(res, err, 400);
    }
  },

  async changePassword(req, res) {
    try {
      const userId = req.user?.id || req.body.userId;
      const { currentPassword, newPassword } = req.body;
      const result = await authService.changePassword(userId, { currentPassword, newPassword });
      return sendSuccess(res, result, "Password updated successfully");
    } catch (err) {
      return sendError(res, err, 400);
    }
  },

  async updateProfile(req, res) {
    try {
      const userId = req.user?.id || req.body.userId;
      const { name, email, preferences } = req.body;
      const updated = await authService.updateProfile(userId, { name, email, preferences });
      return sendSuccess(res, { user: updated }, "Profile updated successfully");
    } catch (err) {
      return sendError(res, err, 400);
    }
  },

  async deleteAccount(req, res) {
    try {
      const userId = req.user?.id || req.body.userId;
      const { phone, email } = req.body;
      const result = await authService.deleteAccount(userId, phone, email);
      return sendSuccess(res, result, "Account deleted successfully");
    } catch (err) {
      return sendError(res, err, 400);
    }
  },
};

