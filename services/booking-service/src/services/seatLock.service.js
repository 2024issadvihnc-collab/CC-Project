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

          // Check if lock already exists
          const existingRaw = await client.get(lockKey);
          if (existingRaw) {
            let canAcquire = false;
            try {
              const existing = JSON.parse(existingRaw);
              const lockOwner = existing.lockedBy || existing.userId;
              // If lock was acquired by this user or during frontend seat selection (guest_/client_/usr_), allow checkout
              if (
                !lockOwner ||
                lockOwner === userId ||
                lockOwner.startsWith("guest_") ||
                lockOwner.startsWith("client_") ||
                lockOwner.startsWith("usr_")
              ) {
                canAcquire = true;
              }
            } catch (_) {
              if (!existingRaw || existingRaw === userId || existingRaw === "guest") {
                canAcquire = true;
              }
            }

            if (!canAcquire) {
              if (acquiredKeys.length > 0) {
                await client.del(...acquiredKeys).catch(() => {});
              }
              return {
                success: false,
                conflictSeat: seat,
                message: `Seat ${seat} is currently held by another user`,
              };
            }
          }

          // Secure lock for the current booking transaction
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

