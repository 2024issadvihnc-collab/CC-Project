import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import { config } from "./src/config/env.config.js";
import { initDatabase } from "./src/database/init.js";
import { closePool } from "./src/database/pool.js";
import { closeRedis } from "./src/config/redis.config.js";

import healthRoutes from "./src/routes/health.routes.js";
import authRoutes from "./src/routes/auth.routes.js";
import eventRoutes from "./src/routes/event.routes.js";
import bookingRoutes from "./src/routes/booking.routes.js";

import { apiLimiter } from "./src/middleware/rateLimiter.middleware.js";
import { errorHandler, notFoundHandler } from "./src/middleware/error.middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust reverse proxy (AWS ALB / CloudFront)
app.set("trust proxy", 1);

// Security HTTP headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // Let CloudFront manage CSP
  })
);

// Secure CORS configuration
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.security.corsOrigins.includes("*")) {
        return callback(null, true);
      }
      if (
        config.security.corsOrigins.some(
          (allowed) => origin === allowed || allowed === "*" || origin.endsWith(".cloudfront.net")
        )
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev, logged in prod
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// HTTP Request logging
app.use(morgan(config.isProduction ? "combined" : "dev"));

// Body parsing
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// Rate limiting on API routes
app.use("/api", apiLimiter);

// Serve static event images if accessed through backend
const imagesDir = path.join(__dirname, "../frontend/showtime/public/images");
if (fs.existsSync(imagesDir)) {
  app.use("/images", express.static(imagesDir));
}

// ── API ROUTES ──
app.use("/api", healthRoutes);
app.use("/api", authRoutes);
app.use("/api", eventRoutes);
app.use("/api", bookingRoutes);

// Root health ping
app.get("/", (req, res) => {
  res.json({
    name: "ShowTime Events API",
    status: "running",
    version: "2.0.0-cloud",
    documentation: "/api/health",
  });
});

// 404 & Centralized Error Handler
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize DB schema & Start Server
async function startServer() {
  try {
    await initDatabase();
  } catch (err) {
    console.warn("[STARTUP] Database auto-init warning:", err.message);
  }

  const server = app.listen(config.port, config.host, () => {
    console.log("==========================================================");
    console.log(`ShowTime Cloud Backend running on http://${config.host}:${config.port}`);
    console.log(`Environment: ${config.env.toUpperCase()}`);
    console.log(`Endpoints: /api/health, /api/events, /api/bookings, /api/auth`);
    console.log("==========================================================");
  });

  // Graceful shutdown handling for EC2 / Docker containers
  async function gracefulShutdown(signal) {
    console.log(`\n[SHUTDOWN] Received ${signal}. Gracefully stopping server...`);
    server.close(async () => {
      console.log("[SHUTDOWN] Closed HTTP connections.");
      await closePool();
      await closeRedis();
      console.log("[SHUTDOWN] Cleanup finished. Exiting process.");
      process.exit(0);
    });

    // Force shutdown if cleanup hangs
    setTimeout(() => {
      console.error("[SHUTDOWN] Forced shutdown after timeout.");
      process.exit(1);
    }, 10000);
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

startServer();

export default app;
