# ShowTime: AWS Security & Hardening Checklist

This document details the security posture, hardening guidelines, and compliance checks implemented in the modernized ShowTime architecture.

---

## 1. Network & Infrastructure Isolation

- [x] **Zero Public Database Exposure**: Amazon RDS PostgreSQL is provisioned strictly in private subnets with `--no-publicly-accessible`.
- [x] **Zero Public Cache Exposure**: Amazon ElastiCache Redis is provisioned in private subnets with no internet gateway route.
- [x] **Strict Security Group Chaining**:
  - `sg-alb` accepts 80/443 from internet.
  - `sg-ec2` accepts port 5000 strictly from `sg-alb`.
  - `sg-rds` accepts port 5432 strictly from `sg-ec2`.
  - `sg-redis` accepts port 6379 strictly from `sg-ec2`.
- [x] **S3 Public Access Blocked**: All 4 S3 Block Public Access flags are enabled. S3 bucket policy strictly permits CloudFront Origin Access Control (`cloudfront.amazonaws.com`).

---

## 2. Secrets & Identity Management

- [x] **No Hardcoded Secrets**: Zero API keys, database credentials, or JWT signing secrets exist in git-tracked files.
- [x] **Gitignore Enforcement**: `.env`, `.env.local`, and sensitive config files are ignored in both frontend and backend `.gitignore`.
- [x] **AWS Secrets Manager**: Database connection strings, Redis auth, and JWT secrets are stored in Secrets Manager and injected securely into EC2 at boot.
- [x] **IAM Least Privilege**: EC2 instances assume an IAM Instance Profile granting access strictly to SSM and designated Secrets Manager resources. No AWS admin access keys are stored on instances.

---

## 3. Data Protection & Encryption

- [x] **Encryption in Transit**:
  - CloudFront enforces `redirect-to-https` for all web traffic (TLS 1.2 / TLS 1.3).
  - ALB uses AWS Certificate Manager (ACM) 2048-bit RSA/ECDSA certificates.
  - RDS parameter group enforces `rds.force_ssl = 1`.
  - Redis supports in-transit encryption (`rediss://`).
- [x] **Encryption at Rest**:
  - Amazon S3 bucket encrypted using AWS KMS (`aws/s3`).
  - Amazon RDS storage encrypted with KMS (`aws/rds`).
  - EC2 EBS root volumes encrypted by default.
  - ElastiCache Redis storage encrypted at rest.
- [x] **Zero Payment Credential Storage**: No credit card numbers, CVVs, or cardholder credentials are ever processed or stored in PostgreSQL or Redis. Payment processing records only transaction IDs and gateway references.

---

## 4. Application Security & OWASP Top 10 Mitigations

| Vulnerability | ShowTime Architecture Mitigation | Implementation Location |
| :--- | :--- | :--- |
| **A01: Broken Access Control** | Signed JWT authentication with expiration; strict verification middleware | `backend/src/middleware/auth.middleware.js` |
| **A02: Cryptographic Failures** | Passwords hashed using bcrypt (10 rounds); SHA-256 for QR passes | `backend/src/services/auth.service.js` |
| **A03: Injection (SQL / NoSQL)** | All database operations use node-postgres parameterized queries (`$1, $2`) | `backend/src/database/repositories/*.js` |
| **A04: Insecure Design** | Atomic DB transactions with unique constraint `uq_active_event_seat` prevent double-booking | `backend/src/database/schema.sql` |
| **A05: Security Misconfiguration** | Helmet middleware applies secure HTTP headers (`HSTS`, `X-Content-Type-Options`) | `backend/server.js` |
| **A06: Vulnerable Components** | Dependencies regularly audited via `npm audit` (0 vulnerabilities) | `backend/package.json` |
| **A07: Identification & Auth** | Rate limiting on auth endpoints (25 req/15min); OTP cooldowns & attempt caps | `backend/src/services/otp.service.js` |
| **A08: Software & Data Integrity**| Build assets fingerprinted with content hashes; CloudFront OAC SigV4 verification | `frontend/showtime/vite.config.js` |
| **A09: Logging & Monitoring** | Morgan HTTP logger; centralized CloudWatch logging; no passwords in logs | `backend/server.js` |
| **A10: SSRF** | API rejects unvetted external resource fetching; strict input sanitization | `backend/src/services/*.js` |

---

## 5. Pre-Production Security Verification Commands

Run these automated checks before cutting over traffic:

```bash
# 1. Verify No Sensitive Files Committed in Git
git status
git log -p | grep -E "DATABASE_URL|JWT_SECRET|password"

# 2. Audit Dependencies for Known CVEs
cd backend && npm audit
cd ../frontend/showtime && npm audit

# 3. Test Rate Limiter Protection
curl -I http://localhost:5000/api/auth/login
# Verify RateLimit-Limit and RateLimit-Remaining headers are returned

# 4. Verify Database Parameterized Protection
# Run Concurrency Test to verify no race conditions or lockouts
node backend/scripts/test-concurrency.js http://localhost:5000
```

