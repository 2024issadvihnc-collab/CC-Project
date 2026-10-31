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
          // Set if Not eXists with expiration (NX EX)
          const result = await client.set(lockKey, userId || "guest", "EX", ttlSeconds, "NX");
          if (!result) {
            // Rollback already acquired locks
            if (acquiredKeys.length > 0) {
              await client.del(...acquiredKeys);
            }
            return {
              success: false,
              conflictSeat: seat,
              message: `Seat ${seat} is currently held by another user`,
            };
          }
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

    // In-memory fallback
    const now = Date.now();
    for (const seat of seats) {
      const lockKey = `${eventId}:${seat}`;
      const existing = inMemoryLocks.get(lockKey);
      if (existing && existing.expiresAt > now && existing.userId !== userId) {
        return {
          success: false,
          conflictSeat: seat,
          message: `Seat ${seat} is currently held by another user`,
        };
      }
    }

    for (const seat of seats) {
      const lockKey = `${eventId}:${seat}`;
      inMemoryLocks.set(lockKey, {
        userId: userId || "guest",
        expiresAt: now + ttlSeconds * 1000,
      });
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

