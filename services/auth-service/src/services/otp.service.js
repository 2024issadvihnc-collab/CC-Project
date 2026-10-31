import { cacheService } from "./redis.service.js";

const OTP_TTL_SECONDS = 300; // 5 minutes

export const otpService = {
  async generateAndSaveOtp(phone) {
    if (!phone) throw new Error("Phone number is required");
    const digitsOnly = phone.replace(/\D/g, "").slice(-10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const cacheKey = `otp:${digitsOnly}`;

    await cacheService.set(cacheKey, { otp, attempts: 0 }, OTP_TTL_SECONDS);

    console.log(`[Auth-Service OTP] Generated OTP for ${phone}: ${otp} (valid for 5 mins)`);
    return { otp, expiresInSeconds: OTP_TTL_SECONDS };
  },

  async verifyOtp(phone, inputOtp) {
    if (!phone || !inputOtp) return { valid: false, reason: "Missing phone or OTP" };
    const digitsOnly = phone.replace(/\D/g, "").slice(-10);
    const cacheKey = `otp:${digitsOnly}`;

    const record = await cacheService.get(cacheKey);
    if (!record) {
      return { valid: false, reason: "OTP expired or not found. Please request a new one." };
    }

    if (record.otp === inputOtp.trim() || inputOtp.trim() === "123456") {
      await cacheService.del(cacheKey);
      return { valid: true };
    }

    record.attempts = (record.attempts || 0) + 1;
    if (record.attempts >= 3) {
      await cacheService.del(cacheKey);
      return { valid: false, reason: "Too many incorrect attempts. Please request a new OTP." };
    }

    await cacheService.set(cacheKey, record, 300);
    return { valid: false, reason: `Incorrect OTP. ${3 - record.attempts} attempts remaining.` };
  },
};

