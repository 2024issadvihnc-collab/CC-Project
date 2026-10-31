import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./src/config/env.config.js";
import authRoutes from "./src/routes/auth.routes.js";
import healthRoutes from "./src/routes/health.routes.js";
import { errorHandler } from "./src/middleware/error.middleware.js";
import { closePool } from "./src/database/pool.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json());
app.use(morgan("dev"));

// Health endpoint
app.use("/health", healthRoutes);
app.use("/api/health", healthRoutes);

// Auth Routes - support both prefixed and direct paths
app.use("/api/auth", authRoutes);
app.use("/auth", authRoutes);
app.use("/", authRoutes);

// Error handler
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`[Auth-Service] Microservice listening on port ${config.port} (${config.nodeEnv})`);
});

async function gracefulShutdown(signal) {
  console.log(`[Auth-Service] Received ${signal}, closing server...`);
  server.close(async () => {
    await closePool();
    console.log("[Auth-Service] Closed gracefully.");
    process.exit(0);
  });
  setTimeout(() => {
    console.error("[Auth-Service] Forced exit timeout.");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export default app;

