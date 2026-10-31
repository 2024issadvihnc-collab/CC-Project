import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./src/config/env.config.js";
import { globalLimiter } from "./src/middleware/rateLimiter.middleware.js";
import { extractAndPropagateUser } from "./src/middleware/auth.middleware.js";
import { buildProxy } from "./src/proxy/serviceProxy.js";
import healthRoutes from "./src/routes/health.routes.js";
import notificationRoutes from "./src/routes/notification.routes.js";
import { setupSocketIO, broadcastToRoom } from "./src/realtime/socket.js";

const app = express();
const server = http.createServer(app);

// Mount Socket.IO Real-time Engine
setupSocketIO(server);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(globalLimiter);
app.use(morgan("dev"));
app.use(express.json());
app.use(extractAndPropagateUser);

// Gateway and aggregated health check
app.use("/api/health", healthRoutes);
app.use("/health", healthRoutes);

// Internal Real-Time Broadcast Endpoint (for Microservices)
app.post("/api/realtime/broadcast", (req, res) => {
  const { room, event, data } = req.body;
  if (!room || !event) {
    return res.status(400).json({ error: "room and event are required" });
  }
  broadcastToRoom(room, event, data || {});
  res.json({ success: true });
});

// Route reverse proxies to the 5 microservices
app.use("/api/auth", buildProxy(config.services.auth));
app.use("/api/events", buildProxy(config.services.event));
app.use("/api/bookings", buildProxy(config.services.booking));
app.use("/api/payments", buildProxy(config.services.payment));
app.use("/api/tickets", buildProxy(config.services.ticket));
app.use("/api/notifications", notificationRoutes);

// Fallback 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.url} - Endpoint not found on API Gateway`,
  });
});

server.listen(config.port, () => {
  console.log(`====================================================`);
  console.log(`[ShowTime API Gateway + Socket.IO] Listening on port ${config.port}`);
  console.log(`- Auth Service:    ${config.services.auth}`);
  console.log(`- Event Service:   ${config.services.event}`);
  console.log(`- Booking Service: ${config.services.booking}`);
  console.log(`- Payment Service: ${config.services.payment}`);
  console.log(`- Ticket Service:  ${config.services.ticket}`);
  console.log(`- Realtime Engine: Socket.IO mounted at /socket.io`);
  console.log(`====================================================`);
});

export default app;

