import crypto from "crypto";
import { config } from "../config/env.config.js";
import { redisService } from "./redis.service.js";

export class OtpError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "OtpError";
    this.status = status;
  }
}

export const otpService = {
  getOtpKey(phone) {
    const clean = phone.replace(/\D/g, "").slice(-10);
    return `otp:${clean}`;
  },

  async sendOtp(phone) {
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length < 10) {
      throw new OtpError("Please provide a valid 10-digit mobile number", 400);
    }

    const key = this.getOtpKey(cleanPhone);
    const existing = await redisService.get(key);

    // Enforce resend cooldown
    if (existing && existing.resendAllowedAt && existing.resendAllowedAt > Date.now()) {
      const waitSec = Math.ceil((existing.resendAllowedAt - Date.now()) / 1000);
      throw new OtpError(`Please wait ${waitSec} seconds before requesting a new OTP`, 429);
    }

    // Generate secure 6-digit OTP
    const code = crypto.randomInt(100000, 999999).toString();
    const ttl = config.otp.expirySeconds;
    const now = Date.now();

    const otpData = {
      phone: `+91 ${cleanPhone}`,
      code,
      attempts: 0,
      createdAt: now,
      expiresAt: now + ttl * 1000,
      resendAllowedAt: now + config.otp.resendCooldownSeconds * 1000,
    };

    await redisService.set(key, otpData, ttl);

    // In production, integrate with Amazon SNS (SMS)
    console.log(`[AUTH-OTP] Sent OTP to +91 ${cleanPhone}: ${code} (Expires in ${ttl}s)`);

    return {
      phone: `+91 ${cleanPhone}`,
      expiresInSeconds: ttl,
      resendCooldownSeconds: config.otp.resendCooldownSeconds,
      // Only include code in response in dev/demo mode for easy testing
      demoCode: config.otp.allowDemoOtp ? "123456" : undefined,
    };
  },

  async verifyOtp(phone, inputCode) {
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (!inputCode) {
      throw new OtpError("OTP code is required", 400);
    }

    const key = this.getOtpKey(cleanPhone);
    const stored = await redisService.get(key);

    // Check demo OTP if allowed
    const isDemoMatch = config.otp.allowDemoOtp && inputCode === "123456";

    if (!stored && !isDemoMatch) {
      throw new OtpError("No active OTP found or OTP has expired. Please request a new OTP", 400);
    }

    if (stored) {
      // Check maximum attempts
      if (stored.attempts >= config.otp.maxAttempts) {
        await redisService.del(key);
        throw new OtpError("Maximum OTP attempts exceeded. Please request a new OTP", 429);
      }

      if (stored.code !== inputCode && !isDemoMatch) {
        stored.attempts += 1;
        const remaining = config.otp.maxAttempts - stored.attempts;
        await redisService.set(key, stored, Math.max(1, Math.ceil((stored.expiresAt - Date.now()) / 1000)));
        throw new OtpError(
          `Invalid OTP code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining`,
          400
        );
      }
    }

    // Valid: cleanup OTP
    await redisService.del(key);
    return { verified: true, phone: `+91 ${cleanPhone}` };
  },
};

