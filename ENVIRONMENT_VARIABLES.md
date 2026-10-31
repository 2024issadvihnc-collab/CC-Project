# ShowTime: Master Environment Variables Catalog

This document provides a comprehensive reference of all environment variables used across the ShowTime frontend, API Gateway, and 5 independent microservices.

---

## 1. Global & Docker Compose Environment Variables (`.env`)

These variables are defined in the root `.env` file (copied from `.env.example`) and ingested by `docker-compose.yml`, `docker-compose.backend.yml`, and `docker-compose.frontend.yml`.

| Variable Name | Required | Default / Example Value | Description |
|---|:---:|---|---|
| `NODE_ENV` | **Yes** | `production` | Operational environment mode (`development`, `production`). |
| `POSTGRES_USER` | **Yes** | `postgres` | Administrative PostgreSQL database username. |
| `POSTGRES_PASSWORD` | **Yes** | `[SECURE_PASSWORD]` | Strong password for PostgreSQL database. |
| `POSTGRES_DB` | **Yes** | `showtime_db` | Main database name containing all 5 service schemas. |
| `JWT_SECRET` | **Yes** | `[SECURE_JWT_KEY]` | 256-bit cryptographically secure secret for token signing. |
| `BACKEND_API_URL` | **Yes** | `http://api-gateway:5000` | Target URL used by Nginx to proxy `/api/*` requests. On Two-EC2, set to `http://<BACKEND_PRIVATE_IP>:5000`. |
| `CORS_ORIGIN` | **Yes** | `http://localhost:5173,http://localhost:3000,http://localhost:80` | Comma-separated list of permitted CORS frontend origins. |

---

## 2. Frontend Web Environment (`frontend/showtime/.env`)

Compiled into static client-side JavaScript by Vite during build time (`npm run build`). **Never place database passwords or private API keys here.**

| Variable Name | Required | Default Value | Description |
|---|:---:|---|---|
| `VITE_API_BASE_URL` | **Yes** | `/api` | Base path used by `src/services/api.js` for API requests. |
| `BACKEND_API_URL` | No | `http://api-gateway:5000` | Runtime environment variable consumed by Nginx reverse proxy template. |

---

## 3. Central API Gateway (`api-gateway/.env`)

| Variable Name | Required | Default Value | Description |
|---|:---:|---|---|
| `PORT` | No | `5000` | Ingress listening port for the API Gateway. |
| `JWT_SECRET` | **Yes** | *Configured via env* | Secret key to verify and decode client JWT tokens. |
| `CORS_ORIGIN` | **Yes** | `http://localhost:5173,http://localhost:80` | Allowed client origins for CORS preflight and responses. |
| `REDIS_URL` | No | `redis://redis:6379` | Redis instance for multi-instance Socket.IO clustering adapter & shared locks. |
| `AUTH_SERVICE_URL` | **Yes** | `http://auth-service:5001` | Routing target URL for `/api/auth/*` traffic. |
| `EVENT_SERVICE_URL` | **Yes** | `http://event-service:5002` | Routing target URL for `/api/events/*` traffic. |
| `BOOKING_SERVICE_URL` | **Yes** | `http://booking-service:5003` | Routing target URL for `/api/bookings/*` traffic. |
| `PAYMENT_SERVICE_URL` | **Yes** | `http://payment-service:5004` | Routing target URL for `/api/payments/*` traffic. |
| `TICKET_SERVICE_URL` | **Yes** | `http://ticket-service:5005` | Routing target URL for `/api/tickets/*` traffic. |

---

## 4. Authentication Service (`services/auth-service/.env`)

| Variable Name | Required | Default Value | Description |
|---|:---:|---|---|
| `PORT` | No | `5001` | Service listening port. |
| `DATABASE_URL` | **Yes** | `postgresql://...search_path=auth_schema` | Connection string scoped to `auth_schema`. |
| `REDIS_URL` | **Yes** | `redis://redis:6379` | Redis instance for storing temporary 5-minute mobile OTPs. |
| `JWT_SECRET` | **Yes** | *Configured via env* | Signing key for issuing Access and Refresh JWT tokens. |
| `JWT_ACCESS_EXPIRES_IN` | No | `1h` | Expiration lifespan of client access tokens. |
| `JWT_REFRESH_EXPIRES_IN`| No | `7d` | Expiration lifespan of refresh tokens. |

---

## 5. Event Service (`services/event-service/.env`)

| Variable Name | Required | Default Value | Description |
|---|:---:|---|---|
| `PORT` | No | `5002` | Service listening port. |
| `DATABASE_URL` | **Yes** | `postgresql://...search_path=event_schema` | Connection string scoped to `event_schema`. |
| `REDIS_URL` | **Yes** | `redis://redis:6379` | Redis instance for high-speed event catalog query caching. |
| `BOOKING_SERVICE_URL` | **Yes** | `http://booking-service:5003` | Inter-service URL to fetch dynamic seat availability from Booking Service. |

---

## 6. Booking Service (`services/booking-service/.env`)

| Variable Name | Required | Default Value | Description |
|---|:---:|---|---|
| `PORT` | No | `5003` | Service listening port. |
| `DATABASE_URL` | **Yes** | `postgresql://...search_path=booking_schema`| Connection string scoped to `booking_schema`. |
| `REDIS_URL` | **Yes** | `redis://redis:6379` | Redis instance for atomic temporary seat holds (`SET ... EX 300 NX`). |
| `PAYMENT_SERVICE_URL` | **Yes** | `http://payment-service:5004` | Inter-service URL for Saga payment execution step. |
| `TICKET_SERVICE_URL` | **Yes** | `http://ticket-service:5005` | Inter-service URL for Saga QR ticket issuance step. |
| `EVENT_SERVICE_URL` | **Yes** | `http://event-service:5002` | Inter-service URL to inspect event metadata. |

---

## 7. Payment Service (`services/payment-service/.env`)

| Variable Name | Required | Default Value | Description |
|---|:---:|---|---|
| `PORT` | No | `5004` | Service listening port. |
| `DATABASE_URL` | **Yes** | `postgresql://...search_path=payment_schema`| Connection string scoped to `payment_schema`. |
| `CORS_ORIGIN` | No | `*` | Allowed CORS origins. |

---

## 8. Ticket Service (`services/ticket-service/.env`)

| Variable Name | Required | Default Value | Description |
|---|:---:|---|---|
| `PORT` | No | `5005` | Service listening port. |
| `DATABASE_URL` | **Yes** | `postgresql://...search_path=ticket_schema` | Connection string scoped to `ticket_schema`. |
| `CORS_ORIGIN` | No | `*` | Allowed CORS origins. |
