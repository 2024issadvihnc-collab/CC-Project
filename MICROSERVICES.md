# ShowTime Microservices Specification

## Service Catalog

| Service | Host Directory | Default Port | Storage Scope | Primary Tech Stack |
|---|---|---|---|---|
| **API Gateway** | `api-gateway/` | `5000` | Stateless | Express, Helmet, Rate-Limit, Morgan |
| **Auth Service** | `services/auth-service/` | `5001` | `auth_schema` + Redis | Express, bcryptjs, jsonwebtoken, pg, ioredis |
| **Event Service** | `services/event-service/` | `5002` | `event_schema` + Redis | Express, pg, ioredis |
| **Booking Service** | `services/booking-service/` | `5003` | `booking_schema` + Redis | Express, pg, ioredis, Saga Coordinator |
| **Payment Service** | `services/payment-service/` | `5004` | `payment_schema` | Express, pg, Idempotency Engine |
| **Ticket Service** | `services/ticket-service/` | `5005` | `ticket_schema` | Express, pg, qrcode |

---

## 1. API Gateway (Port 5000)

### Responsibilities
* **Single Entry Point**: Receives all client traffic directed to `/api/*`.
* **Reverse Proxy Routing**:
  * `/api/auth/*` -> `http://auth-service:5001/api/auth/*`
  * `/api/events/*` -> `http://event-service:5002/api/events/*`
  * `/api/bookings/*` -> `http://booking-service:5003/api/bookings/*`
  * `/api/payments/*` -> `http://payment-service:5004/api/payments/*`
  * `/api/tickets/*` -> `http://ticket-service:5005/api/tickets/*`
* **JWT Token Propagation**: Validates Bearer token and injects verified identity headers:
  * `x-user-id`
  * `x-user-role`
  * `x-user-email`
  * `x-user-phone`
* **Rate Limiting**: Protects backend services against DoS (1000 requests per 15 minutes per IP).
* **Aggregated Health Check**: `GET /api/health` queries all 5 microservices in parallel, returning latency and status.

---

## 2. Authentication Service (Port 5001)

### Responsibilities
* User registration with validation and duplicate prevention.
* Password hashing using `bcryptjs` (salt factor 10).
* Login authentication via phone or email identifier.
* JWT Access Token (1h expiration) and Refresh Token generation.
* OTP generation and verification for mobile login (5-minute expiration in Redis).
* User profile updates and account deletion.

### Key Endpoints
* `POST /api/auth/register` - Create new user account.
* `POST /api/auth/login` - Authenticate with password.
* `POST /api/auth/send-otp` - Dispatch 6-digit OTP to mobile.
* `POST /api/auth/verify-otp` - Validate entered OTP.
* `POST /api/auth/reset-password` - Reset account password.
* `PUT /api/auth/profile` - Update customer profile.
* `DELETE /api/auth/account` - Remove user account.
* `GET /health` - Service health status.

---

## 3. Event Service (Port 5002)

### Responsibilities
* Event catalog management: CRUD operations on live shows, sports, and movies.
* Multi-criteria filtering: category (`music`, `cricket`, `sports`, `dj`, `festival`, `comedy`), city, search query (`q`), and sorting (`date`, `price-asc`, `price-desc`, `popularity`).
* Show timing, venue details, and artist lineup management.
* Dynamic seat tier layout configuration (VIP, Premium, Gold).
* High-speed catalog caching using Redis (60s TTL).

### Key Endpoints
* `GET /api/events` - List events matching filter parameters.
* `GET /api/events/:id` - Detailed event information.
* `GET /api/events/:id/seats` - Dynamic seat tiers and current booked/held seat layout.
* `POST /api/events` - Create event (Admin).
* `DELETE /api/events/:id` - Remove event (Admin).
* `GET /health` - Service health status.

---

## 4. Booking Service (Port 5003)

### Responsibilities
* Seat availability inspection and real-time hold management.
* Concurrency-safe atomic seat booking using PostgreSQL transactions (`SELECT ... FOR UPDATE`).
* Distributed temporary seat locking via Redis (`SET ... EX 300 NX`).
* Inline Saga Transaction Coordinator:
  * Initiates pending booking -> processes payment -> confirms booking -> generates ticket.
  * Triggers automatic compensation (booking cancellation and seat release) if payment fails.
* Customer booking history retrieval.

### Key Endpoints
* `POST /api/bookings` - Execute atomic booking Saga.
* `GET /api/bookings` - Customer booking history (filtered by email, phone, or token).
* `GET /api/bookings/:id` - Booking details by reference.
* `DELETE /api/bookings/:id` - Cancel booking and release seats.
* `GET /api/bookings/events/:eventId/seats` - Currently booked or held seats for an event.
* `GET /health` - Service health status.

---

## 5. Payment Service (Port 5004)

### Responsibilities
* Payment transaction processing and mock gateway settlement.
* **Idempotency Engine**: Inspects `idempotencyKey` to prevent duplicate charges caused by client retries.
* Payment status tracking (`COMPLETED`, `FAILED`, `REFUNDED`).
* Simulated payment failure testing (`paymentMethod: "FAIL"`).
* Refund processing for cancelled bookings.

### Key Endpoints
* `POST /api/payments/process` - Authorize and settle payment transaction.
* `GET /api/payments/:ref` - Retrieve payment transaction details.
* `POST /api/payments/:ref/refund` - Process transaction refund.
* `GET /health` - Service health status.

---

## 6. Ticket Service (Port 5005)

### Responsibilities
* Official ticket generation upon confirmed booking.
* **Scannable QR Code Generation**: Uses `qrcode` library to generate:
  * Base64 PNG Data URLs (embedded directly in web UI).
  * Vector SVG strings for high-resolution displays.
* Gate entry admission verification: Scans ticket reference, verifies validity, and records timestamp (`status: "USED"`).
* Prevents double entry / ticket reuse.

### Key Endpoints
* `POST /api/tickets/generate` - Generate ticket and scannable QR code.
* `GET /api/tickets/:ref` - Ticket information by ticket reference.
* `GET /api/tickets/booking/:bookingRef` - All tickets issued for a booking.
* `POST /api/tickets/:ref/scan` - Venue gate scan admission check.
* `GET /health` - Service health status.

