import { getRedisClient, isRedisAvailable } from "../config/redis.config.js";

const PREFIX = "showtime:";

// Local memory fallback for dev when Redis instance is not yet started
const memoryFallback = new Map();

export const redisService = {
  formatKey(key) {
    return key.startsWith(PREFIX) ? key : `${PREFIX}${key}`;
  },

  async get(key) {
    const fullKey = this.formatKey(key);
    try {
      if (isRedisAvailable()) {
        const client = getRedisClient();
        const data = await client.get(fullKey);
        return data ? JSON.parse(data) : null;
      }
    } catch (_) {}

    const item = memoryFallback.get(fullKey);
    if (!item) return null;
    if (item.expiresAt && item.expiresAt < Date.now()) {
      memoryFallback.delete(fullKey);
      return null;
    }
    return item.value;
  },

  async set(key, value, ttlSeconds = 300) {
    const fullKey = this.formatKey(key);
    const jsonStr = JSON.stringify(value);

    try {
      if (isRedisAvailable()) {
        const client = getRedisClient();
        if (ttlSeconds > 0) {
          await client.set(fullKey, jsonStr, "EX", ttlSeconds);
        } else {
          await client.set(fullKey, jsonStr);
        }
        return true;
      }
    } catch (_) {}

    memoryFallback.set(fullKey, {
      value,
      expiresAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null,
    });
    return true;
  },

  async del(key) {
    const fullKey = this.formatKey(key);
    try {
      if (isRedisAvailable()) {
        const client = getRedisClient();
        await client.del(fullKey);
        return true;
      }
    } catch (_) {}

    memoryFallback.delete(fullKey);
    return true;
  },

  /**
   * Temporary seat reservation hold using Redis atomic SET NX EX.
   * If the seat is already held, returns false.
   */
  async holdSeat(eventId, seatNumber, userId, ttlSeconds = 600) {
    const key = this.formatKey(`hold:${eventId}:${seatNumber}`);
    const payload = JSON.stringify({ userId, eventId, seatNumber, heldAt: Date.now() });

    try {
      if (isRedisAvailable()) {
        const client = getRedisClient();
        const res = await client.set(key, payload, "EX", ttlSeconds, "NX");
        return res === "OK";
      }
    } catch (_) {}

    // Memory fallback hold
    const existing = memoryFallback.get(key);
    if (existing && (!existing.expiresAt || existing.expiresAt > Date.now())) {
      return false;
    }
    memoryFallback.set(key, {
      value: { userId, eventId, seatNumber, heldAt: Date.now() },
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return true;
  },

  async releaseSeat(eventId, seatNumber) {
    const key = `hold:${eventId}:${seatNumber}`;
    return await this.del(key);
  },

  async isSeatHeld(eventId, seatNumber) {
    const key = `hold:${eventId}:${seatNumber}`;
    const data = await this.get(key);
    return !!data;
  },
};

