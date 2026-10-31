import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "5001", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/showtime_db?search_path=auth_schema",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  jwtSecret: process.env.JWT_SECRET || "showtime-production-jwt-secret-key-change-in-prod",
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "1h",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:5000,http://localhost:3000")
    .split(",")
    .map((o) => o.trim()),
};

