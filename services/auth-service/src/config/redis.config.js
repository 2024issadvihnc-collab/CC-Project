import Redis from "ioredis";
import { config } from "./env.config.js";

let redisClient = null;
let isRedisAvailable = false;

try {
  redisClient = new Redis(config.redisUrl, {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 3) return null;
      return Math.min(times * 100, 1000);
    },
    connectTimeout: 2000,
    lazyConnect: true,
  });

  redisClient.connect().catch(() => {});

  redisClient.on("connect", () => {
    isRedisAvailable = true;
    console.log("[Auth-Service Redis] Connected to Redis cluster");
  });

  redisClient.on("error", () => {
    isRedisAvailable = false;
  });
} catch (_) {
  isRedisAvailable = false;
}

export function getRedisClient() {
  return redisClient;
}

export function isRedisConnected() {
  return isRedisAvailable;
}

