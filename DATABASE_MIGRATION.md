# ShowTime: Database Migration Guide (JSON to Amazon RDS PostgreSQL)

This document provides step-by-step instructions to migrate existing data stored in `backend/data/` (`users.json`, `events.json`, `bookings.json`) to the Amazon RDS PostgreSQL relational database.

---

## 1. Migration Overview

The migration script (`backend/scripts/migrate-json-to-pg.js`) performs the following automated workflow:

1. **Safety Backup**: Creates an immutable, timestamped copy of all source JSON files inside `backend/data/backups/backup-<TIMESTAMP>/`. Original files in `backend/data/` are **never** deleted or altered.
2. **Connectivity Test**: Verifies active connectivity to PostgreSQL using `testConnection()`.
3. **DDL Execution**: Applies `backend/src/database/schema.sql` to ensure all 5 tables (`users`, `events`, `bookings`, `booking_seats`, `payments`), indexes, and unique partial constraints exist.
4. **Data Normalization & Insertion**:
   - **Users**: Migrates user IDs, names, emails, phones, preferences, and hashes any unhashed legacy passwords using `bcrypt`.
   - **Events**: Migrates event metadata, ticket pricing, categories, cities, dates, cast members, and seat limits.
   - **Bookings**: Migrates existing booking references (e.g. `ST1PLNLP`), amounts, statuses, and payment snapshots.
   - **Booking Seats**: Populates the relational `booking_seats` table with individual seat IDs (`A1`, `D5`), tiers, and prices.
   - **Payments**: Creates matching payment records without storing raw card numbers or CVVs.
5. **Validation & Verification**: Confirms foreign key integrity and prints a migration summary.

---

## 2. Pre-Migration Prerequisites

1. Ensure the target PostgreSQL database is accessible from your execution environment.
   - For AWS RDS in a private subnet, run this script from an EC2 instance in the same VPC or via AWS Systems Manager Session Manager.
   - For local development, ensure local PostgreSQL is running on port 5432.
2. Export your target database connection string:

```bash
# Example for AWS RDS:
export DATABASE_URL="postgresql://showtime_admin:YOUR_PASSWORD@showtime-postgres-prod.crw12345.us-east-1.rds.amazonaws.com:5432/showtimedb?sslmode=require"

# Example for Local PostgreSQL:
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/showtimedb"
```

---

## 3. Running the Migration

From the project root:

```bash
cd backend
npm install
node scripts/migrate-json-to-pg.js
```

### Expected Output:
```text
==========================================================
Starting ShowTime JSON to PostgreSQL Migration
Database Target: postgresql://showtime_admin:****@showtime-postgres-prod.crw12345.us-east-1.rds.amazonaws.com:5432/showtimedb
==========================================================
[BACKUP] Safely created JSON backup in: /opt/showtime/backend/data/backups/backup-2026-10-31T16-30-00-000Z
[DATABASE] Initializing database schema...
[DATABASE] Schema initialized successfully: tables, indexes, and constraints ready.

[1/3] Migrating 2 Users...
[2/3] Migrating 16 Events...
[3/3] Migrating 5 Bookings & Seats...

==========================================================
MIGRATION SUMMARY REPORT:
==========================================================
Users:    2 imported (2 read)
Events:   16 imported (16 read)
Bookings: 5 imported (5 read)
Seats:    8 confirmed seats recorded
Payments: 5 payments recorded
Backup:   Preserved in /opt/showtime/backend/data/backups/backup-2026-10-31T16-30-00-000Z
Original JSON files left intact in data/
==========================================================
```

---

## 4. Post-Migration Verification Queries

Connect to your database via `psql` or a database GUI to verify records:

```sql
-- 1. Verify Events Count
SELECT category, COUNT(*) FROM events GROUP BY category;

-- 2. Verify Users Table
SELECT id, name, email, phone, created_at FROM users;

-- 3. Verify Confirmed Bookings and Associated Seats
SELECT
  b.booking_reference,
  e.title AS event_title,
  b.total_amount,
  COUNT(bs.id) AS seat_count,
  ARRAY_AGG(bs.seat_number) AS booked_seats
FROM bookings b
JOIN events e ON b.event_id = e.id
LEFT JOIN booking_seats bs ON b.id = bs.booking_id
GROUP BY b.id, b.booking_reference, e.title, b.total_amount;

-- 4. Test Seat Concurrency Constraint
-- Attempting to insert a duplicate active seat should fail with 23505 unique violation:
-- INSERT INTO booking_seats (booking_id, event_id, seat_number, tier, price, reservation_status)
-- VALUES (1, 'e002', 'D5', 'Premium Tier', 1998, 'CONFIRMED');
-- Expected result: ERROR: duplicate key value violates unique constraint "uq_active_event_seat"
```

---

## 5. Rollback Procedure

If you ever need to rollback:
1. The original JSON files in `backend/data/` remain untouched.
2. The timestamped backup in `backend/data/backups/backup-<TIMESTAMP>/` contains exact snapshot copies.
3. You can drop and re-create the tables using:
   ```sql
   DROP TABLE IF EXISTS payments, booking_seats, bookings, events, users CASCADE;
   ```
4. Re-run `node scripts/migrate-json-to-pg.js` whenever ready.
