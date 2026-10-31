# ShowTime Cloud Readiness Audit & 12-Factor Compliance

## 1. Cloud-Native 12-Factor Compliance Assessment

ShowTime has been refactored to comply with the industry-standard **Twelve-Factor App** methodology for cloud-native software.

| Factor | Principle | ShowTime Implementation | Compliance |
|---|---|---|:---:|
| **I. Codebase** | One codebase tracked in revision control, many deploys | Single Git monorepo tracking frontend, gateway, services, and infrastructure templates. Deploys to local, Docker Compose, or AWS. | **COMPLIANT** |
| **II. Dependencies** | Explicitly declare and isolate dependencies | Root workspace and each microservice contains an independent `package.json` and strict `package-lock.json`. No reliance on implicit global packages. | **COMPLIANT** |
| **III. Config** | Store config in the environment | 100% of credentials, secrets, ports, and inter-service URLs are injected via `.env` / environment variables. Zero hardcoded secrets in source code. | **COMPLIANT** |
| **IV. Backing services** | Treat backing services as attached resources | PostgreSQL and Redis are treated as attached resources accessed via standard connection strings (`DATABASE_URL`, `REDIS_URL`). Swappable for Amazon RDS and ElastiCache. | **COMPLIANT** |
| **V. Build, release, run** | Strictly separate build and run stages | Frontend uses multi-stage Docker build (`node:20-alpine` build -> `nginx:alpine` runtime). Microservices separate npm compilation from execution. | **COMPLIANT** |
| **VI. Processes** | Execute the app as one or more stateless processes | Microservices share zero filesystem state. All persistent data lives in PostgreSQL; transient state lives in Redis. Any container can be terminated and restarted without data loss. | **COMPLIANT** |
| **VII. Port binding** | Export services via port binding | API Gateway and microservices bind directly to their assigned TCP port (`PORT=5000-5005`). Nginx binds to `80`. No dependency on external app servers. | **COMPLIANT** |
| **VIII. Concurrency** | Scale out via the process model | Microservices are horizontally scalable behind the API Gateway or Application Load Balancer. State concurrency is guarded in the database via row-level locks and unique indexes. | **COMPLIANT** |
| **IX. Disposability** | Maximize robustness with fast startup and graceful shutdown | All microservices listen for `SIGTERM` and `SIGINT` signals, gracefully terminating database pools and active connections with a 10s timeout. | **COMPLIANT** |
| **X. Dev/prod parity** | Keep development, staging, and production as similar as possible | Local development runs the identical PostgreSQL multi-schema engine, Redis cache, and Docker container images used in cloud environments. | **COMPLIANT** |
| **XI. Logs** | Treat logs as event streams | Services output structured JSON log streams directly to `stdout` / `stderr`. Cloud-ready for Amazon CloudWatch Logs and container log drivers. | **COMPLIANT** |
| **XII. Admin processes** | Run admin/management tasks as one-off processes | Database migration, verification, and seed tasks are implemented as standalone node scripts (`scripts/verify-db-health.js`, `scripts/generate-seeds.js`). | **COMPLIANT** |

---

## 2. Cloud Security Checklist

- [x] **No Plaintext Secrets**: Passwords, JWT secrets, and API tokens are absent from source code and Docker Compose definitions.
- [x] **Git Exclusion**: `.env` and environment overrides are strictly ignored by `.gitignore`.
- [x] **Host Port Isolation**: Databases (PostgreSQL 5432, Redis 6379) and internal microservices (5001-5005) are never published to public host interfaces.
- [x] **Least-Privilege Routing**: Only the API Gateway (port 5000) on the backend and Nginx (port 80) on the frontend are exposed.
- [x] **Safe Password Hashing**: bcrypt salt rounds set to 10 for password storage.
- [x] **Stateless JWT Flow**: Signed tokens with 1-hour expiration and Bearer verification.
- [x] **Rate Limiting**: API Gateway throttles excessive traffic per client IP.
- [x] **Security Headers**: Helmet enabled across services for XSS, frameguard, and content-type sniffing protection.

---

## 3. Scalability & Resilience Audit

1. **Deadlock Prevention**:
   - PostgreSQL transactions lock rows in deterministic order using `FOR UPDATE`.
   - Redis seat locks implement a 300-second TTL to prevent orphan locks if a client disconnects mid-checkout.
2. **Payment Failure Guarantee**:
   - The Saga Coordinator ensures that payment decline triggers automatic cancellation, releases held seats, and blocks ticket issuance.
3. **Idempotent Payment Sinks**:
   - Payment Service rejects duplicate requests bearing the same `idempotencyKey`, preventing double charging during network retries.
4. **Service Health Observability**:
   - Every service exposes `GET /health`.
   - API Gateway provides unified health aggregation at `GET /api/health`.

