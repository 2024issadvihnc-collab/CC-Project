# ShowTime: AWS Cloud Deployment Guide

This guide is the master blueprint for deploying the modernized **ShowTime** event and ticket booking platform onto Amazon Web Services (AWS) using production best practices.

---

## 1. Architectural Summary

| Tier | Component | AWS Service | Purpose |
| :--- | :--- | :--- | :--- |
| **Edge / CDN** | Global CDN | **Amazon CloudFront** | SSL termination, caching static assets, routing `/api/*` to ALB |
| **Frontend** | Static SPA | **Amazon S3** | Hosts compiled React 18 + Vite bundles (`dist/`) behind CloudFront OAC |
| **Load Balancing**| Reverse Proxy | **Application Load Balancer (ALB)** | Distributes incoming HTTPS traffic across EC2 instances |
| **Compute** | Stateless Backend | **Amazon EC2 Auto Scaling Group** | Runs Node.js Express cluster (2 to 8 instances across multiple AZs) |
| **Database** | Relational DB | **Amazon RDS PostgreSQL (Multi-AZ)** | Persistent ACID storage for Users, Events, Bookings, Seats, Payments |
| **Cache & State**| In-Memory Cache | **Amazon ElastiCache for Redis** | Stores distributed OTPs, temporary seat holds, and query caches |
| **DNS & SSL** | Domain & Certs | **Amazon Route 53 & AWS ACM** | Public DNS routing and free auto-renewing TLS certificates |
| **Monitoring** | Logs & Metrics | **Amazon CloudWatch** | Application logging, instance metrics, alarm triggers for autoscaling |

---

## 2. Prerequisites

1. **AWS Account**: Active AWS account with Administrator or PowerUser access.
2. **AWS CLI v2**: Installed and configured locally (`aws configure`).
3. **Domain Name**: Registered in Route 53 (e.g., `showtime.yourdomain.com`).
4. **Node.js**: v20+ LTS installed locally to run migration and test scripts.
5. **Git**: Installed and repository cloned.

---

## 3. End-to-End Deployment Workflow

```mermaid
flowchart TD
    A["1. Create VPC & Subnets (2 Public, 2 Private)"] --> B["2. Provision RDS PostgreSQL & ElastiCache Redis in Private Subnets"]
    B --> C["3. Run Database Migrations (migrate-json-to-pg.js)"]
    C --> D["4. Provision S3 Bucket & Deploy Frontend (dist/)"]
    D --> E["5. Create CloudFront Distribution with S3 OAC & Custom Error 404/403 to /index.html"]
    E --> F["6. Create EC2 Launch Template & Target Group (/api/health)"]
    F --> G["7. Provision Application Load Balancer & Auto Scaling Group"]
    G --> H["8. Configure CloudFront Origin for /api/* pointing to ALB"]
    H --> I["9. Route 53 DNS Pointing to CloudFront"]
    I --> J["10. Verify Live Deployment & Concurrency Tests"]
```

---

## 4. Step-by-Step Deployment Instructions

### Step 1: Network & Security Group Provisioning

1. **VPC Configuration**:
   - CIDR: `10.0.0.0/16`
   - Public Subnets (for ALB & NAT Gateway):
     - `10.0.1.0/24` (us-east-1a)
     - `10.0.2.0/24` (us-east-1b)
   - Private Subnets (for EC2 instances, RDS, and ElastiCache):
     - `10.0.10.0/24` (us-east-1a)
     - `10.0.20.0/24` (us-east-1b)

2. **Security Groups**:
   - `sg-showtime-alb`:
     - Inbound: Ports 80 and 443 from `0.0.0.0/0`
     - Outbound: All traffic to `sg-showtime-ec2`
   - `sg-showtime-ec2`:
     - Inbound: Port 5000 only from `sg-showtime-alb`
     - Outbound: All traffic (or restricted to RDS port 5432 and Redis port 6379)
   - `sg-showtime-rds`:
     - Inbound: Port 5432 only from `sg-showtime-ec2`
     - Outbound: None
   - `sg-showtime-redis`:
     - Inbound: Port 6379 only from `sg-showtime-ec2`
     - Outbound: None

---

### Step 2: Provision RDS PostgreSQL Database

Follow [DATABASE_SETUP.md](./DATABASE_SETUP.md) for complete steps:
1. Create a DB Subnet Group spanning the private subnets.
2. Launch an Amazon RDS PostgreSQL 15/16 database instance:
   - DB Identifier: `showtime-postgres-prod`
   - Master Username: `showtime_admin`
   - Master Password: Store securely in AWS Secrets Manager.
   - DB Name: `showtimedb`
   - Attach `sg-showtime-rds`.
3. Note the endpoint: e.g. `showtime-postgres-prod.crw12345.us-east-1.rds.amazonaws.com`.

---

### Step 3: Run Database Migrations

Follow [DATABASE_MIGRATION.md](./DATABASE_MIGRATION.md):
```bash
cd backend
export DATABASE_URL="postgresql://showtime_admin:YOUR_PASSWORD@showtime-postgres-prod.crw12345.us-east-1.rds.amazonaws.com:5432/showtimedb?sslmode=require"
node scripts/migrate-json-to-pg.js
```
The migration script automatically applies `schema.sql`, safely migrates `users.json`, `events.json`, and `bookings.json`, preserves original backups, and verifies record integrity.

---

### Step 4: Provision Amazon ElastiCache for Redis

1. Navigate to Amazon ElastiCache Console -> Redis clusters.
2. Cluster mode: Disabled.
3. Node type: `cache.t4g.micro` (dev/test) or `cache.m6g.large` (production).
4. Subnet Group: Private subnets.
5. Security Group: Attach `sg-showtime-redis`.
6. Note the Primary Endpoint: `showtime-redis.ng.0001.use1.cache.amazonaws.com:6379`.

---

### Step 5: Deploy the Stateless Backend (EC2 + ALB + ASG)

Follow [BACKEND_DEPLOYMENT.md](./BACKEND_DEPLOYMENT.md):
1. Create an IAM Role `ShowTime-EC2-Role` with `AmazonSSMManagedInstanceCore` and Secrets Manager read permissions.
2. Create Launch Template `showtime-backend-lt`:
   - AMI: Amazon Linux 2023
   - Instance Type: `t4g.small` (ARM Graviton) or `t3.small`
   - User Data script to clone repository, install dependencies, inject environment variables, and launch PM2.
3. Create Target Group `showtime-backend-tg`:
   - Protocol: HTTP, Port: 5000
   - Health Check Path: `/api/health`
   - Healthy threshold: 2, Unhealthy threshold: 3, Timeout: 5s, Interval: 15s
4. Create Application Load Balancer `showtime-alb`:
   - Scheme: Internet-facing
   - Subnets: Public subnets in us-east-1a and us-east-1b
   - Security Group: `sg-showtime-alb`
   - Listeners: HTTPS (port 443) with ACM certificate, forwarding to `showtime-backend-tg`.
5. Create Auto Scaling Group:
   - Desired: 2, Minimum: 2, Maximum: 8
   - Scaling policy: Target Tracking on Average CPU Utilization (70%).

---

### Step 6: Deploy the Frontend (S3 + CloudFront)

Follow [FRONTEND_DEPLOYMENT.md](./FRONTEND_DEPLOYMENT.md):
1. Build production bundle:
   ```bash
   cd frontend/showtime
   npm run build
   ```
2. Create Amazon S3 bucket: `showtime-frontend-<account-id>`. Block all public access.
3. Create CloudFront Origin Access Control (OAC).
4. Sync build assets:
   ```bash
   aws s3 sync dist/assets/ s3://showtime-frontend-<account-id>/assets/ --cache-control "public, max-age=31536000, immutable"
   aws s3 sync dist/images/ s3://showtime-frontend-<account-id>/images/ --cache-control "public, max-age=86400"
   aws s3 cp dist/index.html s3://showtime-frontend-<account-id>/index.html --cache-control "no-cache, no-store, must-revalidate"
   ```
5. Configure CloudFront Distribution:
   - **Default Cache Behavior (`/*`)**: Origin points to S3 via OAC.
   - **Secondary Cache Behavior (`/api/*`)**: Origin points to ALB via HTTPS. Cache Policy: `CachingDisabled` (all requests forwarded directly to backend).
   - **Custom Error Responses**:
     - HTTP 403 -> Response Page: `/index.html`, Response Code: 200
     - HTTP 404 -> Response Page: `/index.html`, Response Code: 200

---

## 5. Verification & Rollback Checklist

1. **Liveness Health Check**:
   ```bash
   curl -I https://showtime.yourdomain.com/api/health
   # Returns 200 OK
   ```
2. **Readiness Health Check**:
   ```bash
   curl https://showtime.yourdomain.com/api/health/ready
   # Returns status: "ready" with database and redis connected
   ```
3. **Seat Concurrency Validation**:
   ```bash
   node backend/scripts/test-concurrency.js https://showtime.yourdomain.com
   # Verifies that only 1 user gets the seat during simultaneous bookings
   ```
4. **Rollback Procedure**:
   - Frontend: `aws s3 sync dist-previous/ s3://... && aws cloudfront create-invalidation --distribution-id ... --paths "/*"`
   - Backend: Update Launch Template version or rollback ASG to previous template.

