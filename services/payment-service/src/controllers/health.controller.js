import { isDbConnected } from "../database/pool.js";

export const healthController = {
  check(req, res) {
    const dbOk = isDbConnected();

    res.status(200).json({
      service: "payment-service",
      status: "HEALTHY",
      port: 5004,
      dependencies: {
        database: dbOk ? "CONNECTED" : "FALLBACK_MODE",
        gateway: "CONNECTED",
      },
      timestamp: new Date().toISOString(),
    });
  },
};

