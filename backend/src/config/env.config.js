import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

// Validate required production environment variables
if (isProduction) {
  const missing = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes("replace_with_a_secure")) {
    missing.push("JWT_SECRET");
  }

  if (missing.length > 0) {
    console.error(`[FATAL] Missing required production environment variables: ${missing.join(", ")}`);
    console.error("Please configure these in your AWS Elastic Beanstalk / EC2 environment / Secrets Manager.");
    process.exit(1);
  }
}

export const config = {
  env: NODE_ENV,
  isProduction,
  isDevelopment: NODE_ENV === "development",
  port: parseInt(process.env.PORT || "5000", 10),
  host: process.env.HOST || "0.0.0.0",

  db: {
    url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/showtimedb",
    poolMin: parseInt(process.env.DB_POOL_MIN || "2", 10),
    poolMax: parseInt(process.env.DB_POOL_MAX || "20", 10),
    timeoutMs: parseInt(process.env.DB_TIMEOUT_MS || "10000", 10),
  },

  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
    connectTimeoutMs: parseInt(process.env.REDIS_CONNECT_TIMEOUT_MS || "5000", 10),
  },

  jwt: {
    secret: process.env.JWT_SECRET || "showtime_default_dev_secret_key_change_in_production_32chars!",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },

  security: {
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10),
    corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:3000")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },

  otp: {
    expirySeconds: parseInt(process.env.OTP_EXPIRY_SECONDS || "300", 10),
    resendCooldownSeconds: parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || "60", 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || "3", 10),
    allowDemoOtp: process.env.ALLOW_DEMO_OTP === "true" || !isProduction,
  },

  booking: {
    seatHoldDurationSeconds: parseInt(process.env.SEAT_HOLD_DURATION_SECONDS || "600", 10),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "200", 10),
    authMaxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || "25", 10),
  },
};

