import { isDbConnected } from "../database/pool.js";

export const healthController = {
  check(req, res) {
    const dbOk = isDbConnected();

    res.status(200).json({
      service: "ticket-service",
      status: "HEALTHY",
      port: 5005,
      dependencies: {
        database: dbOk ? "CONNECTED" : "FALLBACK_MODE",
        qrEngine: "READY",
      },
      timestamp: new Date().toISOString(),
    });
  },
};

