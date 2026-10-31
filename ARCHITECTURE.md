# ShowTime System Architecture Specification

## 1. Executive Summary

**ShowTime** is a cloud-ready, microservices-based event and movie ticket booking platform designed on principles of distributed systems, domain-driven boundaries, and stateless scalability.

```
                           +----------------------------+
                           |   React 18 Single-Page App |
                           |   (Vite / Tailwind / CSS)  |
                           +--------------+-------------+
                                          |
                                          v (HTTP / HTTPS)
                           +----------------------------+
                           |     Central API Gateway    |
                           |   (Port 5000 - Express)    |
                           |  - Rate Limiting (1000/15m)|
                           |  - Security Headers        |
                           |  - JWT Header Propagation  |
                           |  - Aggregated /api/health  |
                           +----+---+---+---+---+-------+
                                |   |   |   |   |
         +----------------------+   |   |   |   +----------------------+
         |                          |   |   |                          |
         v (Sync REST)              v   v   v (Sync REST)              v (Sync REST)
+------------------+         +--------------+         +------------------+
|  Auth Service    |         |Event Service |         | Ticket Service   |
|  Port: 5001      |         |Port: 5002    |         | Port: 5005       |
|  DB: auth_schema |         |DB: event_sch |         | DB: ticket_schema|
+--------+---------+         +-------+------+         +--------+---------+
         |                           |                         |
         +-----------------+         |         +---------------+
                           |         |         |
                           v         v         v
                     +----------------------------------+
                     |    Booking Service (Port 5003)   |
                     |  - Saga Orchestrator             |
                     |  - Atomic Row Locks (FOR UPDATE) |
                     |  - Unique Active Seat Index      |
                     +----------------+-----------------+
                                      |
                                      v (Sync REST)
                     +----------------------------------+
                     |    Payment Service (Port 5004)   |
                     |  - Idempotency Key Engine        |
                     |  - Mock Payment Settlement       |
                     +----------------------------------+
```

---

## 2. Communication Paradigm: Synchronous HTTP REST vs. Asynchronous Messaging

ShowTime implements a clear division between immediate transactions and asynchronous background workloads:

### Current Implementation: Synchronous HTTP REST
* All client-to-gateway and gateway-to-service communication occurs over **Synchronous HTTP REST**.
* The **Booking Service** acts as an inline **Saga Orchestrator**, executing payment processing and ticket issuance via synchronous REST calls with tight request timeouts (5000ms).
* **Rationale**: Eliminates runtime operational overhead, external broker dependencies, and memory footprint during local development and two-EC2 student demonstration environments.

### Future Evolution: Asynchronous Messaging (RabbitMQ / AWS SQS)
* Event schemas are pre-defined in `shared/event-contracts` (`BOOKING_CONFIRMED`, `PAYMENT_COMPLETED`, `TICKET_GENERATED`).
* In high-throughput production setups, heavy non-critical workloads (PDF generation, SMS/WhatsApp confirmation notifications, analytics event streams) will be offloaded to message queues.
* **Current Limitation**: RabbitMQ/SQS is not currently required for core booking transactions; no active broker is running in the default compose stack.

---

## 3. High-Concurrency & Double-Booking Protection Model

ShowTime implements three defensive layers to guarantee zero double bookings:

```
[User Request: Seat A1]
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Distributed In-Memory Lock (Redis TTL)                   │
│    SET lock:seat:e001:A1 <user> EX 300 NX                   │
│    -> Returns 409 Conflict immediately if held              │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Lock Acquired)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. PostgreSQL Row-Level Transaction Lock                    │
│    BEGIN TRANSACTION;                                       │
│    SELECT seat_number FROM booking_seats                    │
│    WHERE event_id = $1 AND seat_number = 'A1'               │
│      AND reservation_status IN ('HELD', 'CONFIRMED')        │
│    FOR UPDATE;                                              │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Seat Available)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Database Partial Unique Constraint                       │
│    INSERT INTO booking_seats (..., 'HELD');                 │
│    Enforced by: uq_booking_active_seat                      │
│    -> Any racing collision throws Postgres 23505            │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Distributed Saga Pattern for Booking Transactions

To maintain data consistency across decoupled services without distributed 2-phase commits:

1. **Phase 1: Reserve & Hold**:
   - Booking Service creates booking in `PENDING` status.
   - Associated seats are inserted in `HELD` status with a 10-minute hold expiration.
2. **Phase 2: Payment Execution**:
   - Synchronous call to Payment Service with unique `idempotencyKey`.
   - If payment is declined or times out:
     - **Compensating Action**: Booking Service updates status to `CANCELLED`, updates seats to `RELEASED`, releases Redis locks.
     - **Ticket Service is never called.** Zero tickets generated.
3. **Phase 3: Confirmation & Ticket Issuance**:
   - On payment success (`COMPLETED`), booking updates to `CONFIRMED` and seats to `CONFIRMED`.
   - Ticket Service is called to generate official scannable QR ticket.
   - Client receives confirmed booking reference and rendered QR code.

---

## 5. Security Architecture

* **Least Privilege Port Exposure**:
  - Internal databases (`postgres:5432`, `redis:6379`) and microservices (`5001`-`5005`) do not publish host ports.
  - The API Gateway on port `5000` is the single ingress point to backend compute.
  - The Frontend on port `80` is the single ingress point to static delivery.
* **Authentication & Token Flow**:
  - Stateless JSON Web Tokens (JWT) signed with HMAC-SHA256.
  - Passwords hashed with bcrypt (cost factor 10).
  - API Gateway validates incoming JWTs and injects `x-user-id`, `x-user-role`, `x-user-email` headers to downstream services.
* **Configuration & Secrets**:
  - Zero plaintext secrets in code or Docker definitions.
  - All variables injected via `.env` / environment variables.

