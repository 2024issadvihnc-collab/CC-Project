import { Router } from "express";
import { config } from "../config/env.config.js";

const router = Router();

async function checkServiceHealth(name, url) {
  const startTime = Date.now();
  try {
    const res = await fetch(`${url}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    const latencyMs = Date.now() - startTime;
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        name,
        url,
        status: "UP",
        statusCode: res.status,
        latencyMs,
        details: data,
      };
    }
    return {
      name,
      url,
      status: "DEGRADED",
      statusCode: res.status,
      latencyMs,
    };
  } catch (err) {
    return {
      name,
      url,
      status: "DOWN",
      error: err.message,
      latencyMs: Date.now() - startTime,
    };
  }
}

router.get("/", async (req, res) => {
  const checkPromises = Object.entries(config.services).map(([name, url]) =>
    checkServiceHealth(name, url)
  );

  const results = await Promise.all(checkPromises);
  const allUp = results.every((r) => r.status === "UP");
  const anyUp = results.some((r) => r.status === "UP");

  const overallStatus = allUp ? "HEALTHY" : anyUp ? "DEGRADED" : "UNHEALTHY";
  const statusCode = overallStatus === "HEALTHY" ? 200 : 207;

  res.status(statusCode).json({
    gateway: "showtime-api-gateway",
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services: results.reduce((acc, curr) => {
      acc[curr.name] = curr;
      return acc;
    }, {}),
  });
});

export default router;

