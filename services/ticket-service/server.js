import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./src/config/env.config.js";
import ticketRoutes from "./src/routes/ticket.routes.js";
import healthRoutes from "./src/routes/health.routes.js";
import { closePool } from "./src/database/pool.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json());
app.use(morgan("dev"));

// Health endpoints
app.use("/health", healthRoutes);
app.use("/api/health", healthRoutes);

// Ticket Routes - support both prefixed and direct paths
app.use("/api/tickets", ticketRoutes);
app.use("/tickets", ticketRoutes);
app.use("/", ticketRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(`[Ticket-Service Error] ${req.method} ${req.url} - ${err.message}`);
  res.status(err.statusCode || 500).json({ success: false, error: err.message });
});

const server = app.listen(config.port, () => {
  console.log(`[Ticket-Service] Microservice listening on port ${config.port} (${config.nodeEnv})`);
});

async function gracefulShutdown(signal) {
  console.log(`[Ticket-Service] Received ${signal}, closing server...`);
  server.close(async () => {
    await closePool();
    console.log("[Ticket-Service] Closed gracefully.");
    process.exit(0);
  });
  setTimeout(() => {
    console.error("[Ticket-Service] Forced exit timeout.");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export default app;

