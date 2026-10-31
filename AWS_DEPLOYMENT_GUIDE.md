# ShowTime: AWS Two-EC2 Student Demonstration Deployment Guide

This guide provides the exact step-by-step procedure to deploy **ShowTime** on two Amazon EC2 instances for course demonstrations, viva assessments, and academic presentations without incurring high AWS infrastructure costs.

---

## 1. Deployment Topology Overview

| Instance | Subnet | Role | Docker Compose File | Exposed Ports |
|---|---|---|---|---|
| **EC2 Instance 1: Frontend** | Public Subnet | Static React App & Nginx Reverse Proxy | `docker-compose.frontend.yml` | **Port 80** (Public HTTP) |
| **EC2 Instance 2: Backend** | Backend / Private Subnet | Central API Gateway, 5 Microservices, PostgreSQL, Redis | `docker-compose.backend.yml` | **Port 5000** (Private to Frontend SG) |

```
[Browser Client]
       │
       ▼ (HTTP:80)
┌──────────────────────────────────────────────┐
│  EC2 Instance 1: Frontend Web Server         │
│  - Public IP: 54.x.x.x                       │
│  - Docker Container: showtime-frontend       │
│  - Nginx serving React build & images        │
│  - Proxies /api/* to http://10.0.2.50:5000   │
└──────────────────────┬───────────────────────┘
                       │
                       ▼ (Private VPC Traffic: Port 5000)
┌──────────────────────────────────────────────┐
│  EC2 Instance 2: Backend Application Server  │
│  - Private IP: 10.0.2.50                     │
│  - Docker Container: showtime-api-gateway    │
│  - Docker Containers: 5 Microservices        │
│  - Docker Container: PostgreSQL 15           │
│  - Docker Container: Redis 7                 │
└──────────────────────────────────────────────┘
```

---

## 2. Prerequisites

1. An active AWS Account.
2. An SSH Key Pair (`.pem`) downloaded from the AWS EC2 Console.
3. Two running Amazon EC2 Instances (Amazon Linux 2023 or Ubuntu 24.04):
   - **Frontend EC2**: `t3.micro` or `t3.small` (1 vCPU, 1–2 GB RAM).
   - **Backend EC2**: `t3.medium` (2 vCPUs, 4 GB RAM recommended to run the 7 containers comfortably).
4. Both instances placed in the same VPC.

---

## 3. Step-by-Step Instructions

### Step 1: Configure Security Groups in AWS Console

1. **Create Frontend Security Group** (`sg-showtime-frontend`):
   - Inbound:
     - TCP `80` (HTTP) from `0.0.0.0/0` (Anywhere)
     - TCP `22` (SSH) from `My IP`
   - Outbound: All traffic.

2. **Create Backend Security Group** (`sg-showtime-backend`):
   - Inbound:
     - TCP `5000` (API Gateway) from `sg-showtime-frontend` (Select the Frontend Security Group as source)
     - TCP `22` (SSH) from `My IP`
   - Outbound: All traffic.

> [!IMPORTANT]
> Never open ports 5432 (Postgres), 6379 (Redis), or 5001–5005 to 0.0.0.0/0. The API Gateway on port 5000 is the sole ingress point to the backend.

---

### Step 2: Deploy EC2 Instance 2 (Backend Application Server)

1. SSH into the **Backend EC2 instance**:
   ```bash
   ssh -i your-key.pem ec2-user@<BACKEND_PUBLIC_IP>
   ```

2. Install Docker and Git:
   ```bash
   sudo dnf update -y
   sudo dnf install -y docker git
   sudo systemctl enable --now docker
   sudo usermod -aG docker ec2-user
   # Exit and reconnect so group membership takes effect
   exit
   ```

3. Clone the repository:
   ```bash
   git clone https://github.com/your-username/ShowTime.git
   cd ShowTime
   ```

4. Configure backend environment:
   ```bash
   cp .env.example .env
   nano .env
   ```
   Set strong passwords for `POSTGRES_PASSWORD` and `JWT_SECRET`. Save and exit.

5. Start the backend microservices suite:
   ```bash
   docker compose -f docker-compose.backend.yml up -d --build
   ```

6. Verify that all 7 containers are healthy and listening:
   ```bash
   docker compose -f docker-compose.backend.yml ps
   curl http://localhost:5000/api/health
   ```
   *Response should return `"status": "HEALTHY"` with all 5 microservices UP.*

7. Note the **Private IPv4 Address** of this Backend EC2 instance from AWS console (e.g. `10.0.2.50`).

---

### Step 3: Deploy EC2 Instance 1 (Frontend Web Server)

1. SSH into the **Frontend EC2 instance**:
   ```bash
   ssh -i your-key.pem ec2-user@<FRONTEND_PUBLIC_IP>
   ```

2. Install Docker and Git:
   ```bash
   sudo dnf update -y
   sudo dnf install -y docker git
   sudo systemctl enable --now docker
   sudo usermod -aG docker ec2-user
   exit
   ```

3. Clone the repository:
   ```bash
   git clone https://github.com/your-username/ShowTime.git
   cd ShowTime
   ```

4. Configure the frontend environment to route to the Backend EC2:
   ```bash
   nano .env
   ```
   Add the following configuration (replace with your Backend EC2 private IP):
   ```env
   BACKEND_API_URL=http://10.0.2.50:5000
   ```

5. Build and run the Frontend Nginx container:
   ```bash
   docker compose -f docker-compose.frontend.yml up -d --build
   ```

6. Verify the frontend container is running:
   ```bash
   docker compose -f docker-compose.frontend.yml ps
   ```

---

### Step 4: Verification and Live Demonstration

1. Open a browser and visit:
   `http://<FRONTEND_PUBLIC_IP>`
2. Test the core user journey:
   - **Splash Screen**: Watch cinematic opening reel and navigate to events.
   - **Events Directory**: Verify all 16 events with photos load from the Event Service.
   - **Interactive Seats & Real-Time Socket.IO**: Click an event (e.g. A.R. Rahman or Diljit Dosanjh), select seats, and verify live pricing. Open a second browser session to verify that holding a seat in session 1 instantly broadcasts `seat:held` in real-time over WebSockets to session 2!
   - **Checkout**: Enter phone number, apply coupon (`SHOW20`), and complete booking.
   - **QR Confirmation**: Verify the official QR ticket renders with booking reference and scannable code.
   - **My Tickets**: Verify booking appears in customer ticket history.
3. Test Gateway health:
   Visit `http://<FRONTEND_PUBLIC_IP>/api/health` — Nginx transparently proxies this to the backend API Gateway and returns the aggregated health of all 5 microservices!

---

## 4. How to Update the Website After Hosting

When updating code, adding features, or deploying bug fixes after hosting on AWS, follow these standard zero-data-loss procedures.

### Scenario A: Updating the Frontend Web App Only
If you made changes to React components, styles, or static assets:

1. SSH into the **Frontend EC2**:
   ```bash
   ssh -i your-key.pem ec2-user@<FRONTEND_PUBLIC_IP>
   cd ShowTime
   ```
2. Pull latest code from GitHub:
   ```bash
   git pull origin main
   ```
3. Rebuild and restart the frontend container:
   ```bash
   docker compose -f docker-compose.frontend.yml up -d --build
   ```
4. Verify deployment health:
   ```bash
   curl -f http://localhost:80/
   ```
   *The backend services, database, and Redis continue running uninterrupted without any downtime.*

---

### Scenario B: Updating Backend Microservices
If you modified one or more backend microservices (e.g. Booking Service, Payment Service, or API Gateway):

1. SSH into the **Backend EC2**:
   ```bash
   ssh -i your-key.pem ec2-user@<BACKEND_PUBLIC_IP>
   cd ShowTime
   ```
2. Pull the latest commits:
   ```bash
   git pull origin main
   ```
3. Rebuild and restart the backend stack:
   ```bash
   docker compose -f docker-compose.backend.yml up -d --build
   ```
   *(To rebuild only a specific service, e.g. booking-service: `docker compose -f docker-compose.backend.yml up -d --build booking-service`)*

4. Verify aggregated health:
   ```bash
   curl http://localhost:5000/api/health
   ```
   *Your PostgreSQL database volume (`showtime_pgdata`) and Redis cache volume (`showtime_redisdata`) are completely persistent and will never lose data across container restarts.*

---

### Scenario C: Applying Database Schema Updates
If you added new database tables or columns:

1. Execute the migration SQL script directly against the running PostgreSQL container:
   ```bash
   docker exec -i showtime-postgres psql -U postgres -d showtime_db < infrastructure/database/migration.sql
   ```
2. Verify table updates without restarting the database:
   ```bash
   docker exec -it showtime-postgres psql -U postgres -d showtime_db -c "\dt auth_schema.*"
   ```

---

### Scenario D: Instant Rollback Procedure
If an updated image fails health checks or introduces an unexpected regression:

1. Rollback git to the previous stable release commit:
   ```bash
   git checkout HEAD~1
   ```
2. Re-trigger the container build:
   ```bash
   # On Frontend EC2:
   docker compose -f docker-compose.frontend.yml up -d --build

   # On Backend EC2:
   docker compose -f docker-compose.backend.yml up -d --build
   ```
3. Verify restored status:
   ```bash
   curl http://localhost:5000/api/health
   ```
