import { isDbConnected } from "../database/pool.js";
import { isRedisConnected } from "../config/redis.config.js";

export const healthController = {
  check(req, res) {
    const dbOk = isDbConnected();
    const redisOk = isRedisConnected();

    res.status(200).json({
      service: "auth-service",
      status: "HEALTHY",
      port: 5001,
      dependencies: {
        database: dbOk ? "CONNECTED" : "FALLBACK_MODE",
        redis: redisOk ? "CONNECTED" : "IN_MEMORY_FALLBACK",
      },
      timestamp: new Date().toISOString(),
    });
  },
};

