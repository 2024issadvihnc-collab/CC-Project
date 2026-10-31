# ShowTime Database Design & Multi-Schema Architecture

## 1. Relational Database Overview

ShowTime utilizes **PostgreSQL 15+** with a multi-schema architecture. Each microservice possesses its own isolated schema namespace.

```
showtime_db
├── auth_schema       (Users, Refresh Tokens, Preferences)
├── event_schema      (Events Catalog, Tiers, Show Schedules)
├── booking_schema    (Bookings, Booking Seats, Hold Expirations)
├── payment_schema    (Payments, Idempotency Keys, Refunds)
└── ticket_schema     (Tickets, QR Code Payloads, Gate Scans)
```

> [!IMPORTANT]
> **Zero Cross-Schema Foreign Keys**: Foreign keys exist strictly within individual schemas. When a service references an entity from another service (e.g. `booking_schema.bookings` storing `event_id` or `user_id`), it is maintained logically as an unconstrained identifier. This allows services to be decoupled into separate physical database instances on Amazon RDS if required.

---

## 2. Detailed Schema Definitions

### Schema 1: `auth_schema`

```sql
CREATE SCHEMA IF NOT EXISTS auth_schema;

CREATE TABLE auth_schema.users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(32) UNIQUE,
  password_hash VARCHAR(255),
  role VARCHAR(32) NOT NULL DEFAULT 'user',
  preferences JSONB DEFAULT '{"city": "Mumbai", "notifications": true}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auth_users_email ON auth_schema.users(LOWER(email));
CREATE INDEX idx_auth_users_phone ON auth_schema.users(phone);

CREATE TABLE auth_schema.refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES auth_schema.users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Schema 2: `event_schema`

```sql
CREATE SCHEMA IF NOT EXISTS event_schema;

CREATE TABLE event_schema.events (
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

CREATE INDEX idx_event_category ON event_schema.events(category);
CREATE INDEX idx_event_city ON event_schema.events(city);
CREATE INDEX idx_event_date ON event_schema.events(event_date);
CREATE INDEX idx_event_status ON event_schema.events(status);
```

### Schema 3: `booking_schema`

```sql
CREATE SCHEMA IF NOT EXISTS booking_schema;

CREATE TABLE booking_schema.bookings (
  id SERIAL PRIMARY KEY,
  booking_reference VARCHAR(32) UNIQUE NOT NULL,
  user_id VARCHAR(64),
  event_id VARCHAR(64) NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  booking_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  payment_status VARCHAR(32) NOT NULL DEFAULT 'UNPAID',
  payment_method VARCHAR(64) DEFAULT 'upi',
  coupon_code VARCHAR(64),
  user_details JSONB,
  event_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_booking_ref ON booking_schema.bookings(booking_reference);
CREATE INDEX idx_booking_user_id ON booking_schema.bookings(user_id);
CREATE INDEX idx_booking_event_id ON booking_schema.bookings(event_id);

CREATE TABLE booking_schema.booking_seats (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES booking_schema.bookings(id) ON DELETE CASCADE,
  event_id VARCHAR(64) NOT NULL,
  seat_number VARCHAR(32) NOT NULL,
  tier VARCHAR(64) NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  reservation_status VARCHAR(32) NOT NULL DEFAULT 'HELD',
  hold_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CRITICAL CONCURRENCY UNIQUE CONSTRAINT:
-- Guarantees no two active (HELD or CONFIRMED) bookings can exist for the same seat
CREATE UNIQUE INDEX uq_booking_active_seat
ON booking_schema.booking_seats (event_id, seat_number)
WHERE reservation_status IN ('HELD', 'CONFIRMED');

CREATE INDEX idx_booking_seats_event_seat ON booking_schema.booking_seats(event_id, seat_number);
```

### Schema 4: `payment_schema`

```sql
CREATE SCHEMA IF NOT EXISTS payment_schema;

CREATE TABLE payment_schema.payments (
  id SERIAL PRIMARY KEY,
  payment_reference VARCHAR(64) UNIQUE NOT NULL,
  booking_reference VARCHAR(32) NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  payment_method VARCHAR(32) NOT NULL DEFAULT 'UPI',
  payment_status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
  idempotency_key VARCHAR(128) UNIQUE,
  gateway_transaction_id VARCHAR(128),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_booking_ref ON payment_schema.payments(booking_reference);
CREATE INDEX idx_payment_idempotency ON payment_schema.payments(idempotency_key);

CREATE TABLE payment_schema.refunds (
  id SERIAL PRIMARY KEY,
  refund_reference VARCHAR(64) UNIQUE NOT NULL,
  payment_reference VARCHAR(64) NOT NULL REFERENCES payment_schema.payments(payment_reference) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  reason TEXT,
  refund_status VARCHAR(32) NOT NULL DEFAULT 'PROCESSED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Schema 5: `ticket_schema`

```sql
CREATE SCHEMA IF NOT EXISTS ticket_schema;

CREATE TABLE ticket_schema.tickets (
  id SERIAL PRIMARY KEY,
  ticket_reference VARCHAR(64) UNIQUE NOT NULL,
  booking_reference VARCHAR(32) NOT NULL,
  event_id VARCHAR(64) NOT NULL,
  seat_number VARCHAR(32) NOT NULL,
  tier VARCHAR(64) NOT NULL DEFAULT 'Reserved',
  price NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
  qr_code_data TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'VALID',
  attendee_name VARCHAR(255),
  attendee_email VARCHAR(255),
  attendee_phone VARCHAR(32),
  scanned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ticket_ref ON ticket_schema.tickets(ticket_reference);
CREATE INDEX idx_ticket_booking_ref ON ticket_schema.tickets(booking_reference);

CREATE TABLE ticket_schema.ticket_scans (
  id SERIAL PRIMARY KEY,
  ticket_reference VARCHAR(64) NOT NULL REFERENCES ticket_schema.tickets(ticket_reference) ON DELETE CASCADE,
  scanned_by VARCHAR(64) NOT NULL DEFAULT 'gate_scanner_01',
  gate_location VARCHAR(64) NOT NULL DEFAULT 'MAIN_ENTRANCE',
  scan_result VARCHAR(32) NOT NULL,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 3. Initialization & Migration Management

### Automatic Initialization via Docker
When PostgreSQL starts via Docker Compose, the initialization script [`infrastructure/database/init-multi-db.sql`](file:///c:/Users/Sadvi/Downloads/AWS_CC-main/AWS_CC-main/infrastructure/database/init-multi-db.sql) is mounted to `/docker-entrypoint-initdb.d/init-multi-db.sql`.
* Automatically creates all 5 schemas.
* Automatically creates all tables, foreign keys, and indexes.
* Seeds default administrative user accounts.
* Idempotently seeds all 16 events (`e001`-`e016`) using `ON CONFLICT (id) DO NOTHING`.

### Database Verification Command
To verify database schemas and row counts at any time:
```bash
node scripts/verify-db-health.js
```

### JSON Migration Backup Policy
* The files located in `backend/data/*.json` are **historical migration backups**.
* The live application **never writes to or modifies these JSON files**.
* When PostgreSQL is running, all reads, writes, transactions, and seat locks are managed by PostgreSQL and Redis.

