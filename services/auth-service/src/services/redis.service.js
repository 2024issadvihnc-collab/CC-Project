import { getRedisClient, isRedisConnected } from "../config/redis.config.js";

const inMemoryStore = new Map();

export const cacheService = {
  async get(key) {
    if (isRedisConnected()) {
      try {
        const val = await getRedisClient().get(key);
        return val ? JSON.parse(val) : null;
      } catch (_) {}
    }
    const item = inMemoryStore.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      inMemoryStore.delete(key);
      return null;
    }
    return item.value;
  },

  async set(key, value, ttlSeconds = 300) {
    if (isRedisConnected()) {
      try {
        await getRedisClient().set(key, JSON.stringify(value), "EX", ttlSeconds);
        return;
      } catch (_) {}
    }
    inMemoryStore.set(key, {
      value,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  },

  async del(key) {
    if (isRedisConnected()) {
      try {
        await getRedisClient().del(key);
        return;
      } catch (_) {}
    }
    inMemoryStore.delete(key);
  },
};

