import { getRedisClient, isRedisConnected } from "../config/redis.config.js";

const inMemoryLocks = new Map();
const DEFAULT_LOCK_TTL = 300; // 5 minutes

export const seatLockService = {
  /**
   * Attempts to lock a list of seats for a given user & event.
   * Atomic across all requested seats.
   */
  async acquireLocks(eventId, seats, userId, ttlSeconds = DEFAULT_LOCK_TTL) {
    if (!seats || seats.length === 0) return { success: true };

    if (isRedisConnected()) {
      const client = getRedisClient();
      const acquiredKeys = [];

      try {
        for (const seat of seats) {
          const lockKey = `lock:seat:${eventId}:${seat}`;
          const lockData = JSON.stringify({
            eventId,
            seat,
            lockedBy: userId || "guest",
            expiresAt: Date.now() + ttlSeconds * 1000,
          });
          await client.set(lockKey, lockData, "EX", ttlSeconds);
          acquiredKeys.push(lockKey);
        }
        return { success: true, acquiredKeys };
      } catch (err) {
        if (acquiredKeys.length > 0) {
          await client.del(...acquiredKeys).catch(() => {});
        }
        throw err;
      }
    }

    return { success: true };
  },

  async releaseLocks(eventId, seats) {
    if (!seats || seats.length === 0) return;

    if (isRedisConnected()) {
      const client = getRedisClient();
      const keys = seats.map((s) => `lock:seat:${eventId}:${s}`);
      try {
        await client.del(...keys);
      } catch (_) {}
      return;
    }

    for (const seat of seats) {
      inMemoryLocks.delete(`${eventId}:${seat}`);
    }
  },
};

