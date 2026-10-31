import { testConnection } from "../database/pool.js";
import { testRedisConnection } from "../config/redis.config.js";
import { config } from "../config/env.config.js";

const startTime = Date.now();

export const healthController = {
  getLiveness(req, res) {
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
    res.json({
      status: "ok",
      service: "ShowTime Events Backend API",
      version: "2.0.0-cloud",
      environment: config.env,
      uptimeSeconds,
      timestamp: new Date().toISOString(),
    });
  },

  async getReadiness(req, res) {
    const dbStatus = await testConnection();
    const redisStatus = await testRedisConnection();

    const isReady = dbStatus.connected;
    const statusCode = isReady ? 200 : 503;

    res.status(statusCode).json({
      status: isReady ? "ready" : "degraded",
      service: "ShowTime Events Backend API",
      checks: {
        database: {
          status: dbStatus.connected ? "connected" : "disconnected",
          error: dbStatus.error || null,
        },
        redis: {
          status: redisStatus.connected ? "connected" : "disconnected",
          error: redisStatus.error || null,
        },
      },
      timestamp: new Date().toISOString(),
    });
  },
};

