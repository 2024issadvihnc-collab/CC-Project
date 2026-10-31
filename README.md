# ShowTime – Dynamic Event Booking Platform (AWS & Cloud Computing Project)

A full-stack, responsive event booking web application featuring real-time seating availability, dynamic authentication, and real-time photos for live concerts, sports, festivals, and comedy shows across India.

---

## 🚀 Key Features & Flow

1. **Cinematic Splash Screen**
   - Features stage light beams, moving 35mm filmstrips, a spinning projector reel, and animated progress bar.
   - Automatically guides the user to the login experience.

2. **Dynamic Authentication (Login Page & Modal)**
   - Mobile number input with country code (`+91`).
   - Dynamic OTP generation & verification via Express Backend (`/api/auth/send-otp` & `/api/auth/verify-otp`).
   - Built-in Demo OTP: `123456` (or any generated OTP) with "Skip & Explore" option.
   - Preserves user session in `localStorage` and server database.

3. **Dynamic Events Directory & Real Photos**
   - 16 real-world events across music, cricket, sports, DJ nightlife, festivals, and stand-up comedy (A.R. Rahman, Diljit Dosanjh, Shreya Ghoshal, Wankhede Stadium T20I, Zakir Khan, Kenny Sebastian, Supersonic, etc.).
   - Integrated real-time high-resolution event photos served from `/public/images/events/`.
   - Category filtering chips, search bar, city selector, and sort options.

4. **Event Details & Ticket Booking (`/event/:id`)**
   - Full event metadata, venue, date, time, artist lineup, verified reviews, and booking guidelines.

5. **Dynamic Real-Time Seat Confirming (`/seats/:id`)**
   - Interactive seat map with VIP Lounge, Premium Tier, and Standard Tier.
   - Live synchronization with the backend: booked seats are dynamically disabled and marked sold out in real-time.
   - Interactive seat selection, ticket quantity selector, and live price calculation.

6. **Order Review & Checkout (`/checkout/:id`)**
   - Real-time countdown timer (10 mins hold).
   - Promo coupon discounts (e.g., `SHOW20`, `MUSIC50`, `SPORT10`, `DILJIT`).
   - Multiple payment methods: UPI, Credit/Debit Card, Net Banking, Wallets.
   - Submits booking payload to the backend REST API (`POST /api/bookings`).

7. **Instant E-Ticket Confirmation (`/confirmation/:bookingId`)**
   - Verified booking ID (e.g. `ST-XXXXXX`).
   - Mobile-ready e-ticket with QR/barcode, seat allocations, event details, and timestamp.
   - One-click print / download support.

8. **My Tickets (`/my-tickets`)**
   - Real-time booking history loaded directly from the backend for the authenticated user.

---

---

## 📚 Architectural & Cloud Readiness Documentation

Complete technical specifications and operational runbooks for ShowTime:

* 🏗️ **[ARCHITECTURE.md](file:///c:/Users/Sadvi/Downloads/AWS_CC-main/AWS_CC-main/ARCHITECTURE.md)**: System architecture, synchronous HTTP REST communication, and Saga pattern.
* 🧩 **[MICROSERVICES.md](file:///c:/Users/Sadvi/Downloads/AWS_CC-main/AWS_CC-main/MICROSERVICES.md)**: Deep dive into all 5 microservices, API Gateway, endpoints, and data scopes.
* 🗄️ **[DATABASE_DESIGN.md](file:///c:/Users/Sadvi/Downloads/AWS_CC-main/AWS_CC-main/DATABASE_DESIGN.md)**: PostgreSQL multi-schema architecture, indexes, and concurrency constraints.
* 🐳 **[DOCKER_SETUP.md](file:///c:/Users/Sadvi/Downloads/AWS_CC-main/AWS_CC-main/DOCKER_SETUP.md)**: Multi-container setup, Docker Compose commands, networking, and volumes.
* ☁️ **[CLOUD_READINESS.md](file:///c:/Users/Sadvi/Downloads/AWS_CC-main/AWS_CC-main/CLOUD_READINESS.md)**: 12-factor cloud audit, security checklist, and stateless resilience.
* 🚀 **[FUTURE_AWS_DEPLOYMENT.md](file:///c:/Users/Sadvi/Downloads/AWS_CC-main/AWS_CC-main/FUTURE_AWS_DEPLOYMENT.md)**: Blueprint for future enterprise AWS cloud hosting (ECS, RDS, ElastiCache, S3).
* ⚙️ **[ENVIRONMENT_VARIABLES.md](file:///c:/Users/Sadvi/Downloads/AWS_CC-main/AWS_CC-main/ENVIRONMENT_VARIABLES.md)**: Master reference catalog of all environment variables.
* 📋 **[AWS_DEPLOYMENT_GUIDE.md](file:///c:/Users/Sadvi/Downloads/AWS_CC-main/AWS_CC-main/AWS_DEPLOYMENT_GUIDE.md)**: Step-by-step Two-EC2 student demonstration deployment.

---

## 🛠️ Project Structure

```
ShowTime/
├── api-gateway/               # Central Reverse Proxy & Rate Limiter (Port 5000)
├── services/
│   ├── auth-service/          # User authentication & bcrypt passwords (Port 5001)
│   ├── event-service/         # 16-event catalog, schedules & seat layouts (Port 5002)
│   ├── booking-service/       # Concurrency locks, unique index, Saga coordinator (Port 5003)
│   ├── payment-service/       # Idempotency engine & mock settlement (Port 5004)
│   └── ticket-service/        # Scannable PNG/SVG QR codes & gate validation (Port 5005)
├── shared/
│   ├── common-utils/          # Custom AppErrors, JSON logger, JWT helpers, response formatters
│   └── event-contracts/       # Domain event topics and validation schemas
├── infrastructure/
│   ├── database/              # PostgreSQL multi-schema DDL & auto-seeding (init-multi-db.sql)
│   └── aws/                   # Reference ECS task definitions and ALB routing rules
├── frontend/showtime/         # React 18 + Vite (Production Nginx SPA container)
├── scripts/                   # Test automation & concurrency stress test suites
├── docker-compose.yml         # Local all-in-one container orchestration
├── docker-compose.backend.yml # Backend EC2 stack (Port 5000 only)
├── docker-compose.frontend.yml# Frontend EC2 stack (Port 80 only)
└── backend/                   # Legacy cloud-ready monolithic backend (verified backup)
```

---

## 🏃‍♂️ How to Run

### Option 1: Full Microservices Suite (Docker Compose)
Runs the entire microservices stack (API Gateway, Auth, Event, Booking, Payment, Ticket services, PostgreSQL, Redis, and React frontend) with a single command:

```bash
docker compose up --build
```
- **Web App**: `http://localhost:80`
- **Central API Gateway**: `http://localhost:5000`
- **Gateway Aggregated Health**: `http://localhost:5000/api/health`

---

### Option 2: Local Microservices (Node.js)
```bash
# 1. Install dependencies
npm install

# 2. Launch all 5 microservices + Central API Gateway simultaneously
npm run start:all

# 3. Start Frontend dev server in another terminal
cd frontend/showtime
npm install
npm run dev
```

---

### Option 3: Automated Microservices Verification Tests
```bash
# Run comprehensive automated test suite across all services
npm run test:microservices

# Run concurrency double-booking prevention stress test
npm run test:concurrency
```

---

### Option 4: AWS Two-EC2 Student Demonstration Deployment
Deploy frontend and backend on two separate EC2 instances:
- **EC2 Instance 1 (Frontend)**: Run `docker compose -f docker-compose.frontend.yml up -d --build` (Port 80)
- **EC2 Instance 2 (Backend)**: Run `docker compose -f docker-compose.backend.yml up -d --build` (Port 5000 only)
- Refer to [AWS_DEPLOYMENT_GUIDE.md](file:///c:/Users/Sadvi/Downloads/AWS_CC-main/AWS_CC-main/AWS_DEPLOYMENT_GUIDE.md) for full step-by-step instructions.

---

### Option 5: Monolithic Standalone Backend (Legacy Verified Backup)
```bash
cd backend
npm install
npm start
```
*Runs on `http://localhost:5000`*

```bash
cd frontend/showtime
npm install
npm run dev
```
*Runs on `http://localhost:5173`*

