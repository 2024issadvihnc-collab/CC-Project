import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "5002", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/showtime_db?search_path=event_schema",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  bookingServiceUrl: process.env.BOOKING_SERVICE_URL || "http://localhost:5003",
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:5000,http://localhost:3000")
    .split(",")
    .map((o) => o.trim()),
};

