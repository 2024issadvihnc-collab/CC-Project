import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "5003", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/showtime_db?search_path=booking_schema",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  paymentServiceUrl: process.env.PAYMENT_SERVICE_URL || "http://localhost:5004",
  ticketServiceUrl: process.env.TICKET_SERVICE_URL || "http://localhost:5005",
  eventServiceUrl: process.env.EVENT_SERVICE_URL || "http://localhost:5002",
  authServiceUrl: process.env.AUTH_SERVICE_URL || "http://localhost:5001",
  jwtSecret: process.env.JWT_SECRET || "showtime-production-jwt-secret-key-change-in-prod",
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:5000,http://localhost:3000")
    .split(",")
    .map((o) => o.trim()),
};

