# ShowTime: Future AWS Cloud Deployment Blueprint

## 1. Overview

This document serves as the architectural reference blueprint for transitioning ShowTime from local/two-EC2 demonstration into a fully managed, enterprise-scale AWS cloud deployment.

> [!NOTE]
> **No AWS resources are currently provisioned or active.** This document outlines the planned infrastructure mappings, Terraform/CloudFormation parameters, and operational runbooks for future deployment.

---

## 2. Target AWS Managed Services Architecture

```
                                [Internet Clients]
                                        │
                                        ▼ (HTTPS:443)
                            ┌───────────────────────┐
                            │   Amazon Route 53     │ (DNS)
                            └───────────┬───────────┘
                                        │
                                        ▼
                            ┌───────────────────────┐
                            │   Amazon CloudFront   │ (Global Edge CDN / SSL)
                            └─────┬───────────┬─────┘
                                  │           │
       /* (Static Web Assets)     │           │ /api/* (Dynamic APIs)
                                  ▼           ▼
┌───────────────────────────────────┐   ┌───────────────────────────────────┐
│ Amazon S3 (Static Hosting)        │   │ Application Load Balancer (ALB)   │
│ - Origin Access Control (OAC)     │   │ - Path-Based Target Groups        │
│ - Compiled React 18 + Vite Bundles│   │ - SSL Termination (ACM)           │
└───────────────────────────────────┘   └─────────────────┬─────────────────┘
                                                          │
                                                          ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ AWS Fargate (Amazon ECS Cluster)                                          │
│                                                                           │
│ ┌─────────────────────────┐                                               │
│ │ showtime-api-gateway    │ (Task Definition: 0.5 vCPU, 1 GB RAM)         │
│ └────────────┬────────────┘                                               │
│              │                                                            │
│       ┌──────┴───────┬──────────────┬──────────────┬──────────────┐       │
│       ▼              ▼              ▼              ▼              ▼       │
│ ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐ │
│ │auth-serv  │  │event-serv │  │book-serv  │  │pay-serv   │  │tkt-serv   │ │
│ └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘ │
│       │              │              │              │              │       │
└───────┼──────────────┼──────────────┼──────────────┼──────────────┼───────┘
        │              │              │              │              │
        ▼              ▼              ▼              ▼              ▼
┌───────────────────────────────────────────┐ ┌─────────────────────────────┐
│ Amazon RDS PostgreSQL (Multi-AZ)          │ │ Amazon ElastiCache Redis    │
│ - auth_schema, event_schema, booking_sch  │ │ - OTP expiration            │
│ - payment_schema, ticket_schema           │ │ - Temporary seat locks      │
└───────────────────────────────────────────┘ └─────────────────────────────┘
```

---

## 3. Service-by-Service AWS Mapping

| On-Prem / Local Component | Target AWS Managed Service | Sizing / Configuration Recommendation |
|---|---|---|
| **Static Frontend Hosting** | **Amazon S3 + CloudFront** | S3 bucket with OAC; CloudFront with custom 404/403 error mapping to `/index.html`. |
| **API Reverse Proxy** | **Application Load Balancer** | Path-based routing rules forwarding `/api/auth/*`, `/api/events/*` directly to target groups. |
| **Microservices Compute** | **AWS Fargate (Amazon ECS)** | Serverless container execution; Auto Scaling policies based on CPU/Memory and request count. |
| **Relational Database** | **Amazon RDS PostgreSQL** | PostgreSQL 15, `db.t3.medium` or `db.t3.large`, Multi-AZ deployment for zero-downtime failover. |
| **In-Memory Cache & State** | **Amazon ElastiCache Redis** | Cluster mode disabled, `cache.t3.medium`, Multi-AZ with automatic failover enabled. |
| **Asynchronous Messaging** | **Amazon SQS / SNS** | Standard SQS queues for asynchronous event contracts (`booking-events.fifo`, `ticket-generation`). |
| **Container Registry** | **Amazon ECR** | Private ECR repositories for each microservice with vulnerability scanning on push. |
| **Centralized Logging** | **Amazon CloudWatch Logs** | `/ecs/showtime-*` log groups with 30-day retention policies and CloudWatch Metric Alarms. |
| **Secrets Management** | **AWS Secrets Manager** | Encrypted storage for `DATABASE_URL` and `JWT_SECRET` with automatic rotation capability. |

---

## 4. Migration Roadmap (When Ready to Deploy)

### Step 1: Container Image Push to Amazon ECR
```bash
# 1. Authenticate Docker with Amazon ECR
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com

# 2. Build and tag images
docker tag showtime-api-gateway:latest <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/showtime/api-gateway:latest
docker tag showtime-booking-service:latest <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/showtime/booking-service:latest

# 3. Push to ECR
docker push <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/showtime/api-gateway:latest
docker push <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/showtime/booking-service:latest
```

### Step 2: Database Initialization on Amazon RDS
Connect using standard `psql` to execute the schema initializer:
```bash
psql -h <RDS_ENDPOINT> -U postgres -d showtime_db -f infrastructure/database/init-multi-db.sql
```

### Step 3: Frontend Deployment to Amazon S3
```bash
# 1. Build optimized production bundle
cd frontend/showtime
npm run build

# 2. Sync to private S3 bucket
aws s3 sync dist/ s3://showtime-frontend-production --delete

# 3. Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id <DISTRIBUTION_ID> --paths "/*"
```

