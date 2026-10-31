import dotenv from "dotenv";
dotenv.config();

export const emailConfig = {
  host: process.env.SMTP_HOST || "localhost",
  port: parseInt(process.env.SMTP_PORT || "1025", 10), // Default Mailpit port: 1025
  secure: process.env.SMTP_SECURE === "true",
  user: process.env.SMTP_USER || "",
  pass: process.env.SMTP_PASS || "",
  from: process.env.EMAIL_FROM || "ShowTime Events <no-reply@showtime.local>",
  isProduction: process.env.NODE_ENV === "production",
};

