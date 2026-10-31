-- =============================================================================
-- ShowTime Microservices Multi-Database / Multi-Schema Initialization
-- PostgreSQL 15+ compatible with zero cross-database foreign key coupling
-- =============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. AUTH SERVICE SCHEMA & TABLES
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS auth_schema;

CREATE TABLE IF NOT EXISTS auth_schema.users (
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

CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_schema.users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_auth_users_phone ON auth_schema.users(phone);

CREATE TABLE IF NOT EXISTS auth_schema.refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES auth_schema.users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 2. EVENT SERVICE SCHEMA & TABLES
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS event_schema;

CREATE TABLE IF NOT EXISTS event_schema.events (
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

CREATE INDEX IF NOT EXISTS idx_event_category ON event_schema.events(category);
CREATE INDEX IF NOT EXISTS idx_event_city ON event_schema.events(city);
CREATE INDEX IF NOT EXISTS idx_event_date ON event_schema.events(event_date);
CREATE INDEX IF NOT EXISTS idx_event_status ON event_schema.events(status);

-- =============================================================================
-- 3. BOOKING SERVICE SCHEMA & TABLES
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS booking_schema;

CREATE TABLE IF NOT EXISTS booking_schema.bookings (
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

CREATE INDEX IF NOT EXISTS idx_booking_ref ON booking_schema.bookings(booking_reference);
CREATE INDEX IF NOT EXISTS idx_booking_user_id ON booking_schema.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_booking_event_id ON booking_schema.bookings(event_id);
CREATE INDEX IF NOT EXISTS idx_booking_created_at ON booking_schema.bookings(created_at DESC);

CREATE TABLE IF NOT EXISTS booking_schema.booking_seats (
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

-- CRITICAL CONCURRENCY REQUIREMENT:
-- Enforce that no two active (HELD or CONFIRMED) bookings can exist for the same seat of the same event
CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_active_seat
ON booking_schema.booking_seats (event_id, seat_number)
WHERE reservation_status IN ('HELD', 'CONFIRMED');

CREATE INDEX IF NOT EXISTS idx_booking_seats_event_seat ON booking_schema.booking_seats(event_id, seat_number);
CREATE INDEX IF NOT EXISTS idx_booking_seats_booking_id ON booking_schema.booking_seats(booking_id);

CREATE TABLE IF NOT EXISTS booking_schema.booking_cancellations (
  id SERIAL PRIMARY KEY,
  cancellation_reference VARCHAR(64) UNIQUE NOT NULL,
  booking_reference VARCHAR(32) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  refund_amount NUMERIC(10, 2) NOT NULL,
  cancellation_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
  refund_percentage INTEGER NOT NULL,
  refund_reference VARCHAR(64),
  refund_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  reason VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cancellation_booking_ref ON booking_schema.booking_cancellations(booking_reference);
CREATE INDEX IF NOT EXISTS idx_cancellation_user_id ON booking_schema.booking_cancellations(user_id);

-- =============================================================================
-- 4. PAYMENT SERVICE SCHEMA & TABLES
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS payment_schema;

CREATE TABLE IF NOT EXISTS payment_schema.payments (
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

CREATE INDEX IF NOT EXISTS idx_payment_booking_ref ON payment_schema.payments(booking_reference);
CREATE INDEX IF NOT EXISTS idx_payment_idempotency ON payment_schema.payments(idempotency_key);

CREATE TABLE IF NOT EXISTS payment_schema.refunds (
  id SERIAL PRIMARY KEY,
  refund_reference VARCHAR(64) UNIQUE NOT NULL,
  payment_reference VARCHAR(64) NOT NULL REFERENCES payment_schema.payments(payment_reference) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  reason TEXT,
  refund_status VARCHAR(32) NOT NULL DEFAULT 'PROCESSED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 5. TICKET SERVICE SCHEMA & TABLES
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS ticket_schema;

CREATE TABLE IF NOT EXISTS ticket_schema.tickets (
  id SERIAL PRIMARY KEY,
  ticket_reference VARCHAR(64) UNIQUE NOT NULL,
  booking_reference VARCHAR(32) NOT NULL,
  event_id VARCHAR(64) NOT NULL,
  seat_number VARCHAR(32) NOT NULL,
  tier VARCHAR(64) NOT NULL DEFAULT 'Reserved',
  price NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
  qr_code_data TEXT NOT NULL,
  verification_token VARCHAR(128),
  status VARCHAR(32) NOT NULL DEFAULT 'VALID',
  attendee_name VARCHAR(255),
  attendee_email VARCHAR(255),
  attendee_phone VARCHAR(32),
  scanned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_ref ON ticket_schema.tickets(ticket_reference);
CREATE INDEX IF NOT EXISTS idx_ticket_verification_token ON ticket_schema.tickets(verification_token);
CREATE INDEX IF NOT EXISTS idx_ticket_booking_ref ON ticket_schema.tickets(booking_reference);
CREATE INDEX IF NOT EXISTS idx_ticket_event_id ON ticket_schema.tickets(event_id);

CREATE TABLE IF NOT EXISTS ticket_schema.ticket_scans (
  id SERIAL PRIMARY KEY,
  ticket_reference VARCHAR(64) NOT NULL REFERENCES ticket_schema.tickets(ticket_reference) ON DELETE CASCADE,
  scanned_by VARCHAR(64) NOT NULL DEFAULT 'gate_scanner_01',
  gate_location VARCHAR(64) NOT NULL DEFAULT 'MAIN_ENTRANCE',
  scan_result VARCHAR(32) NOT NULL,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 6. NOTIFICATION MODULE SCHEMA & TABLES
-- =============================================================================
CREATE SCHEMA IF NOT EXISTS notification_schema;

CREATE TABLE IF NOT EXISTS notification_schema.notifications (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  type VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_user ON notification_schema.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_unread ON notification_schema.notifications(user_id) WHERE is_read = FALSE;



-- =============================================================================
-- SEED DATA FOR EVENT SERVICE & AUTH SERVICE (Auto-initialized on start)
-- =============================================================================

-- Seed Admin and Demo User (Password: "Demo@12345" and "Admin@12345")
INSERT INTO auth_schema.users (id, name, email, phone, password_hash, role, preferences)
VALUES
  ('usr_admin_01', 'ShowTime Admin', 'admin@showtime.local', '+91 9999900000', '$2a$10$wT8hTqL3XvXwYV8qW7iY.ObZk4bE1Y5Yt8lG9wG3r4t5y6u7i8o9p', 'admin', '{"city": "Mumbai", "notifications": true}'::jsonb),
  ('usr_demo_01', 'Demo Customer', 'customer@showtime.local', '+91 9800012345', '$2a$10$wT8hTqL3XvXwYV8qW7iY.ObZk4bE1Y5Yt8lG9wG3r4t5y6u7i8o9p', 'user', '{"city": "Mumbai", "notifications": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Seed 16 Real-World Events

INSERT INTO event_schema.events (
  id, title, subtitle, description, category, city, venue,
  event_date, event_time, duration, price, max_price,
  image_url, rating, votes, tags, cast_members, total_seats, filled_pct, status
) VALUES (
  'e001', 'A.R. Rahman – The Wonderment Tour', 'Live with full orchestra · Special Laser Show', 'Witness the Oscar-winning maestro A.R. Rahman live in concert on his record-breaking Wonderment Tour. An immersive audio-visual spectacle featuring a 60-piece live orchestra, stunning laser projection mapping, and an unforgettable setlist spanning three decades of musical genius.',
  'music', 'Delhi', 'Jawaharlal Nehru Stadium',
  '2026-11-21', '7:00 PM', '3h', 1499, 9999,
  '/images/events/e001.jpg', 4.9, 24870, ARRAY['Live Orchestra', 'World Tour', 'Iconic'], '[{"name":"A.R. Rahman","role":"Composer / Vocalist"},{"name":"Ranjit Barot","role":"Drums"},{"name":"Naveen Kumar","role":"Conductor"}]'::jsonb,
  45000, 0.82, 'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO event_schema.events (
  id, title, subtitle, description, category, city, venue,
  event_date, event_time, duration, price, max_price,
  image_url, rating, votes, tags, cast_members, total_seats, filled_pct, status
) VALUES (
  'e002', 'Diljit Dosanjh – Aura India Tour', 'Stadium Concert · High Energy Production', 'After conquering global stages, Diljit Dosanjh brings his electrifying Aura Tour back to India. Expect high-energy performances, massive production, and hits from his entire discography. Don''t miss the biggest Punjabi concert of the year!',
  'music', 'Mumbai', 'Mahalaxmi Race Course',
  '2026-11-27', '6:30 PM', '2.5h', 999, 7999,
  '/images/events/e002.jpg', 4.8, 38210, ARRAY['Stadium Show', 'Live Nation', 'Sold Out Zone'], '[{"name":"Diljit Dosanjh","role":"Vocalist / Performer"},{"name":"DJ H","role":"DJ"}]'::jsonb,
  65000, 0.91, 'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO event_schema.events (
  id, title, subtitle, description, category, city, venue,
  event_date, event_time, duration, price, max_price,
  image_url, rating, votes, tags, cast_members, total_seats, filled_pct, status
) VALUES (
  'e003', 'Diljit Dosanjh – Aura India Tour', 'Stadium Concert · Ahmedabad Edition', 'Diljit Dosanjh''s Aura Tour hits the world''s largest cricket stadium in Ahmedabad. A night of power-packed performances and unforgettable memories.',
  'music', 'Ahmedabad', 'Narendra Modi Stadium',
  '2026-11-21', '7:00 PM', '2.5h', 999, 7999,
  '/images/events/e003.jpg', 4.8, 28100, ARRAY['Biggest Stadium India', 'Live Nation'], '[{"name":"Diljit Dosanjh","role":"Vocalist / Performer"}]'::jsonb,
  90000, 0.78, 'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO event_schema.events (
  id, title, subtitle, description, category, city, venue,
  event_date, event_time, duration, price, max_price,
  image_url, rating, votes, tags, cast_members, total_seats, filled_pct, status
) VALUES (
  'e004', 'Shreya Ghoshal Live', 'A Night of Classical Melodies', 'India''s most beloved classical-pop singer Shreya Ghoshal performs live at the stunning District Arena. Expect timeless Bollywood classics, devotional numbers, and new-age hits accompanied by a live ensemble.',
  'music', 'Bengaluru', 'District Arena by Terraform',
  '2026-11-22', '7:30 PM', '2h', 799, 4999,
  '/images/events/e004.jpg', 4.9, 19540, ARRAY['Soulful', 'Live Band', 'Premium'], '[{"name":"Shreya Ghoshal","role":"Vocalist"},{"name":"Shaan","role":"Special Guest"}]'::jsonb,
  8000, 0.67, 'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO event_schema.events (
  id, title, subtitle, description, category, city, venue,
  event_date, event_time, duration, price, max_price,
  image_url, rating, votes, tags, cast_members, total_seats, filled_pct, status
) VALUES (
  'e005', 'Shillong Cherry Blossom Festival 2026', '3-Day Music & Culture Extravaganza', 'One of India''s most spectacular festivals set against the backdrop of blooming cherry blossoms. Features international headliners, indie local acts, art installations, food stalls, and the breathtaking natural beauty of Meghalaya.',
  'festival', 'Shillong', 'Ward''s Lake Grounds',
  '2026-11-20', '4:00 PM', '3 Days', 599, 2999,
  '/images/events/e005.jpg', 4.7, 11200, ARRAY['Festival Pass', 'Multi-Day', 'Cultural'], '[{"name":"Soulmate","role":"Blues / Rock"},{"name":"Lou Majaw","role":"Indie Legend"},{"name":"Various International Artists","role":"Headliners"}]'::jsonb,
  15000, 0.55, 'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO event_schema.events (
  id, title, subtitle, description, category, city, venue,
  event_date, event_time, duration, price, max_price,
  image_url, rating, votes, tags, cast_members, total_seats, filled_pct, status
) VALUES (
  'e006', 'Royal Enfield Motoverse 2026', '3-Day Moto Festival · Goa Beach Edition', 'The iconic Royal Enfield Motoverse returns to Goa with 3 days of dirt tracking, stunt shows, custom bike exhibitions, and heavy-hitting live music including indie artist showcases and massive DJ nights.',
  'festival', 'Goa', 'Vagator Beach Grounds',
  '2026-11-28', '10:00 AM', '3 Days', 499, 1999,
  '/images/events/e006.jpg', 4.6, 9870, ARRAY['Moto Culture', 'Live Music', 'Festival'], '[{"name":"Multiple DJs","role":"Night Stage"},{"name":"Indie Bands","role":"Live Music"}]'::jsonb,
  20000, 0.42, 'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO event_schema.events (
  id, title, subtitle, description, category, city, venue,
  event_date, event_time, duration, price, max_price,
  image_url, rating, votes, tags, cast_members, total_seats, filled_pct, status
) VALUES (
  'e007', 'India vs Australia – T20I Series', '3rd T20I · Live International Cricket', 'The epic India-Australia T20I series comes to the iconic Wankhede Stadium for a crunch decider. Witness world-class cricket action with fireworks, cheerleaders, and the electric atmosphere of Mumbai''s favourite cricket ground.',
  'cricket', 'Mumbai', 'Wankhede Stadium',
  '2026-11-14', '7:00 PM', '4h', 750, 8000,
  '/images/events/e007.jpg', 4.9, 52000, ARRAY['International', 'T20', 'India vs AUS'], '[{"name":"Team India","role":"Home Team"},{"name":"Australia","role":"Visiting Team"}]'::jsonb,
  33000, 0.95, 'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO event_schema.events (
  id, title, subtitle, description, category, city, venue,
  event_date, event_time, duration, price, max_price,
  image_url, rating, votes, tags, cast_members, total_seats, filled_pct, status
) VALUES (
  'e008', 'IPL 2027 Pre-Season Warm Up', 'Exhibition Match · Mumbai Indians vs CSK', 'The two greatest IPL franchises face off in an exciting pre-season exhibition. See your favourite IPL stars in action before the main season kicks off — complete with DJ night and fan-meets after the match!',
  'cricket', 'Mumbai', 'DY Patil Stadium',
  '2026-11-30', '7:30 PM', '4h', 500, 5000,
  '/images/events/e008.jpg', 4.7, 31500, ARRAY['Exhibition', 'IPL Stars', 'Fan Event'], '[{"name":"Mumbai Indians","role":"Team 1"},{"name":"Chennai Super Kings","role":"Team 2"}]'::jsonb,
  55000, 0.71, 'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO event_schema.events (
  id, title, subtitle, description, category, city, venue,
  event_date, event_time, duration, price, max_price,
  image_url, rating, votes, tags, cast_members, total_seats, filled_pct, status
) VALUES (
  'e009', 'Pro Kabaddi League – Season 12 Finals', 'Live Sport · Grand Finale Night', 'The biggest night in Indian Kabaddi! Two powerhouse franchises battle for the ultimate glory at the Pro Kabaddi League Season 12 Grand Finale. High-octane action, electrifying atmosphere guaranteed.',
  'sports', 'Delhi', 'Indira Gandhi Indoor Stadium',
  '2026-11-18', '8:00 PM', '3h', 299, 2000,
  '/images/events/e009.jpg', 4.5, 8760, ARRAY['Kabaddi', 'Finals', 'LIVE'], '[{"name":"Patna Pirates","role":"Team 1"},{"name":"Dabang Delhi","role":"Team 2"}]'::jsonb,
  14000, 0.6, 'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO event_schema.events (
  id, title, subtitle, description, category, city, venue,
  event_date, event_time, duration, price, max_price,
  image_url, rating, votes, tags, cast_members, total_seats, filled_pct, status
) VALUES (
  'e010', 'ISL – Mumbai City FC vs Bengaluru FC', 'Indian Super League · Derby Night', 'One of the most fiercely contested rivalries in the Indian Super League — Mumbai City FC take on Bengaluru FC in a high-stakes derby. Experience live football at its most electric!',
  'sports', 'Mumbai', 'DY Patil Stadium',
  '2026-11-09', '7:30 PM', '2h', 299, 3000,
  '/images/events/e010.jpg', 4.4, 7200, ARRAY['Football', 'ISL', 'Derby'], '[{"name":"Mumbai City FC","role":"Home"},{"name":"Bengaluru FC","role":"Away"}]'::jsonb,
  55000, 0.48, 'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO event_schema.events (
  id, title, subtitle, description, category, city, venue,
  event_date, event_time, duration, price, max_price,
  image_url, rating, votes, tags, cast_members, total_seats, filled_pct, status
) VALUES (
  'e011', 'SUPERSONIC INDIA 2026', 'Multi-Stage Electronic Music Festival', 'India''s biggest electronic music festival returns with 4 stages, 30+ international DJs, stunning light installations, and 12 hours of non-stop electronic euphoria. Featuring Techno, House, Trance, and Bass music across dedicated stages.',
  'dj', 'Mumbai', 'MMRDA Grounds',
  '2026-11-07', '5:00 PM', '10h', 1499, 5999,
  '/images/events/e011.jpg', 4.8, 22100, ARRAY['EDM', 'Multi-Stage', 'All Night'], '[{"name":"Martin Garrix","role":"Headliner"},{"name":"Blasterjaxx","role":"Main Stage"},{"name":"Zaeden","role":"India Stage"},{"name":"DJ Chetas","role":"Bollywood Beats Stage"}]'::jsonb,
  30000, 0.88, 'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO event_schema.events (
  id, title, subtitle, description, category, city, venue,
  event_date, event_time, duration, price, max_price,
  image_url, rating, votes, tags, cast_members, total_seats, filled_pct, status
) VALUES (
  'e012', 'ECHOES – Electronic Sunset Session', 'Open Air DJ Night · Beachside', 'The ultimate beachside DJ experience in Goa. Watch the sun set over the Arabian Sea to deep house music before the night turns into an all-out trance and electronic extravaganza under the stars.',
  'dj', 'Goa', 'Ozran Beach Shack',
  '2026-11-15', '4:00 PM', '8h', 699, 2999,
  '/images/events/e012.jpg', 4.6, 6450, ARRAY['Sunset', 'Beach', 'House Music'], '[{"name":"Arjun Vagale","role":"Headliner"},{"name":"Kohra","role":"B2B Set"}]'::jsonb,
  3000, 0.73, 'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO event_schema.events (
  id, title, subtitle, description, category, city, venue,
  event_date, event_time, duration, price, max_price,
  image_url, rating, votes, tags, cast_members, total_seats, filled_pct, status
) VALUES (
  'e013', 'Zakir Khan – Tathastu World Tour', 'Stand-Up Comedy Special · Live', 'India''s most beloved stand-up comedian Zakir Khan brings his new Tathastu World Tour to Mumbai. Expect side-splitting stories, sharp observations, and the warmth that has made ''Sakht Launda'' a national phenomenon.',
  'comedy', 'Mumbai', 'Nehru Centre Auditorium',
  '2026-11-12', '8:00 PM', '1.5h', 499, 1999,
  '/images/events/e013.jpg', 4.9, 16780, ARRAY['Stand-Up', 'Hindi', 'Award Winning'], '[{"name":"Zakir Khan","role":"Comedian"}]'::jsonb,
  2000, 0.96, 'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO event_schema.events (
  id, title, subtitle, description, category, city, venue,
  event_date, event_time, duration, price, max_price,
  image_url, rating, votes, tags, cast_members, total_seats, filled_pct, status
) VALUES (
  'e014', 'Kenny Sebastian: The Overthinker Returns', 'Comedy Night · English & Hindi', 'Kenny Sebastian brings his new solo special to Bengaluru — the city that gave birth to his career. Fresh material, new observations, and the wit that has made him one of India''s top comedic voices.',
  'comedy', 'Bengaluru', 'Alliance Française',
  '2026-11-25', '7:30 PM', '1.5h', 399, 1499,
  '/images/events/e014.jpg', 4.7, 9320, ARRAY['Stand-Up', 'English', 'Millennial Humour'], '[{"name":"Kenny Sebastian","role":"Comedian"}]'::jsonb,
  400, 0.85, 'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO event_schema.events (
  id, title, subtitle, description, category, city, venue,
  event_date, event_time, duration, price, max_price,
  image_url, rating, votes, tags, cast_members, total_seats, filled_pct, status
) VALUES (
  'e015', 'A.R. Rahman – The Wonderment Tour', 'Mumbai Edition · Jio World Garden', 'The Wonderment Tour kicks off in Mumbai — A.R. Rahman and his 60-piece orchestra transform Jio World Garden into a breathtaking sensory experience.',
  'music', 'Mumbai', 'Jio World Garden',
  '2026-11-01', '7:00 PM', '3h', 1499, 9999,
  '/images/events/e015.jpg', 4.9, 31200, ARRAY['Live Orchestra', 'World Tour', 'Sold Out'], '[{"name":"A.R. Rahman","role":"Composer / Vocalist"},{"name":"Ranjit Barot","role":"Drums"}]'::jsonb,
  20000, 0.99, 'ACTIVE'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO event_schema.events (
  id, title, subtitle, description, category, city, venue,
  event_date, event_time, duration, price, max_price,
  image_url, rating, votes, tags, cast_members, total_seats, filled_pct, status
) VALUES (
  'e016', 'Diljit Dosanjh – Aura India Tour', 'Bengaluru Edition · NICE Grounds', 'The Aura Tour concludes its India leg in Bengaluru with what promises to be the biggest show of the series. Massive production, full band, and special surprises.',
  'music', 'Bengaluru', 'NICE Grounds',
  '2026-11-29', '6:30 PM', '2.5h', 999, 7999,
  '/images/events/e016.jpg', 4.8, 21880, ARRAY['Stadium Show', 'Live Nation'], '[{"name":"Diljit Dosanjh","role":"Vocalist / Performer"}]'::jsonb,
  40000, 0.84, 'ACTIVE'
) ON CONFLICT (id) DO NOTHING;
