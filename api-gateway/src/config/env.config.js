import dotenv from "dotenv";
dotenv.config();

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";

export const config = {
  port: parseInt(process.env.PORT || "5000", 10),
  nodeEnv,
  isProduction,
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  jwtSecret: process.env.JWT_SECRET || (isProduction ? undefined : "showtime-dev-jwt-secret-key-2026"),
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:3000,http://localhost:80")
    .split(",")
    .map((o) => o.trim()),
  services: {
    auth: process.env.AUTH_SERVICE_URL || "http://localhost:5001",
    event: process.env.EVENT_SERVICE_URL || "http://localhost:5002",
    booking: process.env.BOOKING_SERVICE_URL || "http://localhost:5003",
    payment: process.env.PAYMENT_SERVICE_URL || "http://localhost:5004",
    ticket: process.env.TICKET_SERVICE_URL || "http://localhost:5005",
  },
};

