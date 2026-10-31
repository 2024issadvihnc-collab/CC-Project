# ShowTime: Environment Variables Reference Guide

This document provides a comprehensive reference of all environment variables used by the ShowTime frontend and backend applications, including sensitivity, defaults, and AWS injection best practices.

---

## 1. Frontend Environment Variables (`frontend/showtime`)

Frontend variables are compiled into static assets by Vite during `npm run build`. They are visible in client-side JavaScript. **Never put backend secrets, database passwords, or private API keys in frontend environment variables.**

| Variable Name | Required | Default Value | Description |
| :--- | :---: | :--- | :--- |
| `VITE_API_BASE_URL` | **Yes** | `/api` | Base URL used by `src/services/api.js` for all HTTP fetch requests. For CloudFront path routing, set to `/api`. For separate domain, set to `https://api.yourdomain.com/api`. |
| `VITE_BACKEND_PROXY_TARGET` | No | `http://localhost:5000` | Target URL used by Vite's local development server proxy in `vite.config.js`. |

---

## 2. Backend Environment Variables (`backend`)

Backend variables are loaded at startup by `src/config/env.config.js` via `dotenv` and validated. In production, missing critical variables will abort startup to prevent running in an insecure state.

| Variable Name | Required in Prod | Default Value | Description | Sensitivity |
| :--- | :---: | :--- | :--- | :---: |
| `PORT` | No | `5000` | Port on which the Express server listens. In EC2/Elastic Beanstalk, defaults to 5000 or provided by environment. | Low |
| `NODE_ENV` | **Yes** | `development` | Environment mode (`development`, `production`, `test`). Controls logging format, error stack visibility, and security validations. | Low |
| `HOST` | No | `0.0.0.0` | Network interface to bind to. `0.0.0.0` is required for Docker / EC2 behind ALB. | Low |
| `DATABASE_URL` | **Yes** | `postgresql://...` | Full PostgreSQL connection string with credentials, host, port, database, and SSL mode. | **CRITICAL** |
| `DB_POOL_MIN` | No | `2` | Minimum active connections maintained in the `pg.Pool`. | Low |
| `DB_POOL_MAX` | No | `20` | Maximum simultaneous connections allowed per Node.js process. | Low |
| `DB_TIMEOUT_MS` | No | `10000` | Connection timeout in milliseconds before throwing an acquisition error. | Low |
| `REDIS_URL` | **Yes** | `redis://localhost:6379`| Connection string for Amazon ElastiCache for Redis (or local Redis). | **HIGH** |
| `REDIS_CONNECT_TIMEOUT_MS` | No | `5000` | Connection timeout in milliseconds for the Redis client. | Low |
| `JWT_SECRET` | **Yes** | *None in Prod* | 256-bit cryptographically secure secret used to sign and verify authentication tokens. | **CRITICAL** |
| `JWT_EXPIRES_IN` | No | `7d` | Token validity duration (e.g. `24h`, `7d`). | Medium |
| `BCRYPT_SALT_ROUNDS` | No | `10` | Cost factor for password hashing via bcrypt (10 to 12). | Low |
| `CORS_ORIGINS` | **Yes** | `http://localhost:5173` | Comma-separated list of allowed frontend origins (e.g. `https://showtime.yourdomain.com`). | Medium |
| `OTP_EXPIRY_SECONDS` | No | `300` | Time-to-live for SMS OTP codes in seconds (default 5 minutes). | Low |
| `OTP_RESEND_COOLDOWN_SECONDS` | No | `60` | Cooldown period before a user can request another OTP. | Low |
| `OTP_MAX_ATTEMPTS` | No | `3` | Maximum incorrect verification attempts before OTP is invalidated. | Low |
| `ALLOW_DEMO_OTP` | No | `false` in Prod | When `true`, accepts demo code `123456` in development/testing. Set to `false` in production. | Medium |
| `SEAT_HOLD_DURATION_SECONDS` | No | `600` | Temporary reservation hold duration in Redis (10 minutes). | Low |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` | Time window for rate limiting in ms (15 minutes). | Low |
| `RATE_LIMIT_MAX_REQUESTS` | No | `200` | Max requests per IP in the rate-limiting window. | Low |
| `AUTH_RATE_LIMIT_MAX_REQUESTS`| No | `25` | Max authentication attempts per IP in 15 minutes. | Low |

---

## 3. Recommended AWS Secrets Manager Setup

In production, store backend configuration in AWS Secrets Manager as a single JSON secret:

### Secret Name: `showtime/production/backend`
```json
{
  "NODE_ENV": "production",
  "PORT": "5000",
  "HOST": "0.0.0.0",
  "DATABASE_URL": "postgresql://showtime_admin:MySuperSecretPass123!@showtime-postgres-prod.crw12345.us-east-1.rds.amazonaws.com:5432/showtimedb?sslmode=require",
  "REDIS_URL": "redis://showtime-redis.ng.0001.use1.cache.amazonaws.com:6379",
  "JWT_SECRET": "c7f98e6b12d4a78e5f3c9a1b2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e",
  "JWT_EXPIRES_IN": "7d",
  "CORS_ORIGINS": "https://showtime.yourdomain.com,https://d123456abcdef8.cloudfront.net",
  "ALLOW_DEMO_OTP": "false"
}
```

### Retrieving Secret in EC2 User Data:
```bash
aws secretsmanager get-secret-value \
  --secret-id showtime/production/backend \
  --query SecretString \
  --output text | jq -r 'to_entries|map("\(.key)=\(.value|tostring)")|.[]' > /opt/showtime/backend/.env
```

