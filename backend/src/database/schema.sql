-- =============================================================================
-- ShowTime RDS PostgreSQL Normalized Database Schema
-- Production-Ready for AWS Cloud Deployment
-- =============================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(32) UNIQUE,
  password_hash VARCHAR(255),
  preferences JSONB DEFAULT '{"city": "Mumbai", "notifications": true}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- 2. EVENTS TABLE
CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  subtitle TEXT,
  description TEXT,
  category VARCHAR(64) NOT NULL,
  city VARCHAR(64) NOT NULL,
  venue VARCHAR(255) NOT NULL,
  event_date DATE NOT NULL,
  event_time VARCHAR(32) NOT NULL,
  duration VARCHAR(32),
  price NUMERIC(10, 2) NOT NULL,
  max_price NUMERIC(10, 2),
  image_url VARCHAR(512),
  rating NUMERIC(3, 1) DEFAULT 4.5,
  votes INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  cast_members JSONB DEFAULT '[]',
  total_seats INTEGER DEFAULT 1000,
  filled_pct NUMERIC(4, 2) DEFAULT 0.0,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_city ON events(city);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

-- 3. BOOKINGS TABLE
CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  booking_reference VARCHAR(32) UNIQUE NOT NULL,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  event_id VARCHAR(64) NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  total_amount NUMERIC(10, 2) NOT NULL,
  booking_status VARCHAR(32) NOT NULL DEFAULT 'CONFIRMED',
  payment_status VARCHAR(32) NOT NULL DEFAULT 'PAID',
  payment_method VARCHAR(64) DEFAULT 'upi',
  coupon_code VARCHAR(64),
  user_details JSONB,
  event_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_ref ON bookings(booking_reference);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_event_id ON bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at DESC);

-- 4. BOOKING SEATS TABLE (With strict database-level concurrency protection)
CREATE TABLE IF NOT EXISTS booking_seats (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
  event_id VARCHAR(64) NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  seat_number VARCHAR(32) NOT NULL,
  tier VARCHAR(64) NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  reservation_status VARCHAR(32) NOT NULL DEFAULT 'CONFIRMED',
  hold_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CRITICAL CONCURRENCY REQUIREMENT:
-- Enforce that no two active (HELD or CONFIRMED) bookings can exist for the same seat of the same event
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_event_seat
ON booking_seats (event_id, seat_number)
WHERE reservation_status IN ('HELD', 'CONFIRMED');

CREATE INDEX IF NOT EXISTS idx_booking_seats_event_seat ON booking_seats(event_id, seat_number);
CREATE INDEX IF NOT EXISTS idx_booking_seats_booking_id ON booking_seats(booking_id);

-- 5. PAYMENTS TABLE (No card/CVV credentials stored)
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  payment_reference VARCHAR(64) UNIQUE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  payment_status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
  payment_gateway VARCHAR(64) NOT NULL DEFAULT 'UPI',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_ref ON payments(payment_reference);

