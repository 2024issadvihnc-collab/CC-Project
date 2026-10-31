import Redis from "ioredis";
import { config } from "./env.config.js";

let redisClient = null;
let isRedisConnected = false;

export function getRedisClient() {
  if (!redisClient) {
    try {
      redisClient = new Redis(config.redis.url, {
        connectTimeout: config.redis.connectTimeoutMs,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        retryStrategy(times) {
          if (times > 3) {
            // Stop spamming reconnect attempts in development if local redis is not running
            return null;
          }
          return Math.min(times * 1000, 3000);
        },
      });

      redisClient.on("connect", () => {
        isRedisConnected = true;
        console.log("[REDIS] Connected successfully to Redis instance.");
      });

      redisClient.on("error", (err) => {
        isRedisConnected = false;
        if (config.isDevelopment) {
          // Log once or quietly in dev
        } else {
          console.error("[REDIS] Redis client error:", err.message);
        }
      });

      redisClient.on("close", () => {
        isRedisConnected = false;
      });
    } catch (err) {
      console.warn("[REDIS] Failed to initialize Redis client:", err.message);
      redisClient = null;
    }
  }
  return redisClient;
}

export async function testRedisConnection() {
  try {
    const client = getRedisClient();
    if (!client) return { connected: false, error: "Redis client not initialized" };
    if (client.status === "wait") {
      await client.connect();
    }
    const pong = await client.ping();
    isRedisConnected = pong === "PONG";
    return { connected: isRedisConnected, message: "Redis PONG received" };
  } catch (err) {
    isRedisConnected = false;
    return { connected: false, error: err.message };
  }
}

export function isRedisAvailable() {
  return isRedisConnected;
}

export async function closeRedis() {
  if (redisClient) {
    console.log("[REDIS] Closing Redis connection...");
    try {
      await redisClient.quit();
    } catch (_) {
      redisClient.disconnect();
    }
    redisClient = null;
    isRedisConnected = false;
  }
}

