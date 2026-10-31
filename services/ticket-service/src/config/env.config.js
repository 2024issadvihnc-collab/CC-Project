import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "5005", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/showtime_db?search_path=ticket_schema",
  ticketSecret: process.env.TICKET_SECRET || process.env.JWT_SECRET || "showtime_secure_ticket_key_2026",
  bookingServiceUrl: process.env.BOOKING_SERVICE_URL || "http://localhost:5003",
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:5000,http://localhost:3000")
    .split(",")
    .map((o) => o.trim()),
};

