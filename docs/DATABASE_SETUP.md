# ShowTime: Amazon RDS PostgreSQL Database Setup Guide

This guide details the provisioning, hardening, and configuration of the production Amazon RDS PostgreSQL database for ShowTime.

---

## 1. Database Specifications & Sizing Recommendations

| Parameter | Development / Staging | Production |
| :--- | :--- | :--- |
| **Engine** | PostgreSQL 16.2 | PostgreSQL 16.2 |
| **Instance Class** | `db.t4g.micro` (Free Tier eligible) | `db.r6g.large` (Memory Optimized) |
| **Deployment** | Single-AZ | **Multi-AZ** (Synchronous Standby Replica) |
| **Storage Type** | General Purpose SSD (gp3) | General Purpose SSD (gp3) |
| **Allocated Storage** | 20 GB | 100 GB (Autoscaling up to 1,000 GB) |
| **IOPS** | 3,000 baseline | 6,000 provisioned IOPS |
| **Backup Retention** | 1 day | 30 days automated backups + point-in-time recovery |
| **Network Isolation**| Private DB Subnet (No Public IP) | Private DB Subnet (No Public IP) |
| **Encryption** | AWS KMS default (`aws/rds`) | Dedicated Customer Managed Key (CMK) |

---

## 2. AWS CLI Provisioning Instructions

### Step 1: Create DB Subnet Group
RDS requires a subnet group spanning at least two Availability Zones in your VPC:

```bash
aws rds create-db-subnet-group \
  --db-subnet-group-name showtime-rds-subnet-group \
  --db-subnet-group-description "Private subnets for ShowTime RDS" \
  --subnet-ids "<PRIVATE-SUBNET-1-ID>" "<PRIVATE-SUBNET-2-ID>"
```

### Step 2: Create RDS Security Group
The database must **never** be accessible to the public internet. Only the EC2 application security group (`sg-showtime-ec2`) is allowed:

```bash
# Create Security Group
aws ec2 create-security-group \
  --group-name sg-showtime-rds \
  --description "Security group for ShowTime RDS PostgreSQL" \
  --vpc-id <VPC-ID>

# Authorize Inbound Port 5432 strictly from EC2 Backend instances
aws ec2 authorize-security-group-ingress \
  --group-id <SG-RDS-ID> \
  --protocol tcp \
  --port 5432 \
  --source-group <SG-EC2-ID>
```

### Step 3: Launch the RDS PostgreSQL Instance

```bash
aws rds create-db-instance \
  --db-instance-identifier showtime-postgres-prod \
  --db-instance-class db.t4g.small \
  --engine postgres \
  --engine-version 16.2 \
  --master-username showtime_admin \
  --master-user-password "CHANGE_TO_STRONG_PASSWORD_HERE" \
  --allocated-storage 50 \
  --max-allocated-storage 500 \
  --storage-type gp3 \
  --no-publicly-accessible \
  --db-subnet-group-name showtime-rds-subnet-group \
  --vpc-security-group-ids <SG-RDS-ID> \
  --db-name showtimedb \
  --backup-retention-period 14 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "Sun:04:30-Sun:05:30" \
  --storage-encrypted \
  --enable-performance-insights
```

---

## 3. Custom DB Parameter Group Tuning

Create an optimized parameter group `showtime-postgres16-params`:

```bash
aws rds create-db-parameter-group \
  --db-parameter-group-name showtime-postgres16-params \
  --db-parameter-group-family postgres16 \
  --description "Tuned parameter group for ShowTime"
```

### Recommended Parameters:
- `statement_timeout = 15000` (15 seconds, prevents runaway unindexed queries from locking resources)
- `idle_in_transaction_session_timeout = 30000` (30 seconds, terminates orphaned transactions)
- `rds.force_ssl = 1` (Enforces TLS encryption in transit for all client connections)
- `log_min_duration_statement = 250` (Logs all queries executing longer than 250ms to CloudWatch)

---

## 4. Connection Pooling Configuration

ShowTime uses `node-postgres` (`pg.Pool`) in `backend/src/database/pool.js`.

### Client Pool Settings:
- `max: 20` connections per Node.js worker process.
- `idleTimeoutMillis: 30000` (Releases idle sockets after 30 seconds).
- `connectionTimeoutMillis: 10000` (Times out if pool cannot acquire socket in 10s).
- **Amazon RDS Proxy** (Optional for massive scale): If scaling beyond 20 EC2 instances (spawning > 100 worker processes), attach an **Amazon RDS Proxy** to multiplex hundreds of incoming client connections over a compact pool of established DB connections.

---

## 5. Security & Credentials Management

Store the database connection string in **AWS Secrets Manager**:

```bash
aws secretsmanager create-secret \
  --name "showtime/production/database" \
  --description "Connection string for ShowTime RDS PostgreSQL" \
  --secret-string '{"DATABASE_URL":"postgresql://showtime_admin:YOUR_PASSWORD@showtime-postgres-prod.crw12345.us-east-1.rds.amazonaws.com:5432/showtimedb?sslmode=require"}'
```

