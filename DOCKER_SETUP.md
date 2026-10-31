# ShowTime Docker Setup & Container Orchestration Guide

## 1. Overview

ShowTime is packaged as a multi-container Docker application. Every component (Frontend, API Gateway, 5 Microservices, PostgreSQL, and Redis) has an independent, production-ready container definition.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Docker Bridge Network: showtime-net                                        │
│                                                                             │
│  ┌───────────────────────┐                                                 │
│  │  showtime-frontend    │ -> Exposed Host Port 80                          │
│  └───────────┬───────────┘                                                 │
│              │ (Reverse Proxy /api)                                         │
│              ▼                                                              │
│  ┌───────────────────────┐                                                 │
│  │  showtime-api-gateway │ -> Exposed Host Port 5000                        │
│  └─────┬─────────────┬───┘                                                 │
│        │             │                                                      │
│        ▼             ▼                                                      │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐     │
│  │auth-serv  │ │event-serv │ │book-serv  │ │pay-serv   │ │tkt-serv   │     │
│  │(5001)     │ │(5002)     │ │(5003)     │ │(5004)     │ │(5005)     │     │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘     │
│        │             │             │             │             │           │
│        └───────┬─────┴─────────────┴─────────────┴─────────────┘           │
│                ▼                                                           │
│  ┌───────────────────────┐   ┌───────────────────────┐                     │
│  │  showtime-postgres    │   │  showtime-redis       │                     │
│  │  (Port 5432 Internal) │   │  (Port 6379 Internal) │                     │
│  └───────────────────────┘   └───────────────────────┘                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Docker Compose Files

The repository provides three Docker Compose files for different operational environments:

| File | Intended Target | Exposed Host Ports | Description |
|---|---|---|---|
| [`docker-compose.yml`](file:///c:/Users/Sadvi/Downloads/AWS_CC-main/AWS_CC-main/docker-compose.yml) | Local All-in-One | `80:80`, `5000:5000` | Complete local development stack with all 7 services running together. |
| [`docker-compose.backend.yml`](file:///c:/Users/Sadvi/Downloads/AWS_CC-main/AWS_CC-main/docker-compose.backend.yml) | Backend EC2 | `5000:5000` | Production backend stack: Database, Cache, 5 Microservices, and API Gateway only. |
| [`docker-compose.frontend.yml`](file:///c:/Users/Sadvi/Downloads/AWS_CC-main/AWS_CC-main/docker-compose.frontend.yml) | Frontend EC2 | `80:80` | Production web server running Nginx, routing `/api` to Backend EC2 Private IP. |

---

## 3. Essential Docker Commands

### Starting the Full Application
```bash
# Build images and start all containers in detached mode
docker compose up -d --build
```

### Viewing Container Status & Health
```bash
docker compose ps
```
*Shows status, healthcheck status, and container uptime.*

### Inspecting Real-Time Logs
```bash
# View combined logs across all containers
docker compose logs -f

# View logs for a specific microservice
docker compose logs -f api-gateway
docker compose logs -f booking-service
docker compose logs -f payment-service
```

### Stopping the Application
```bash
# Stop containers without removing persistent volumes
docker compose down

# Stop containers and remove volumes (clean slate reset)
docker compose down -v
```

### Restarting a Specific Service
```bash
docker compose restart booking-service
docker compose restart api-gateway
```

### Running Commands Inside a Container
```bash
# Open interactive PostgreSQL shell inside container
docker compose exec postgres psql -U postgres -d showtime_db

# Query row count in event_schema.events
docker compose exec postgres psql -U postgres -d showtime_db -c "SELECT COUNT(*) FROM event_schema.events;"
```

---

## 4. Persistent Volume Management

The application declares two named Docker volumes in `docker-compose.yml`:

* **`showtime_pgdata`**: Preserves PostgreSQL database tables, schemas, and bookings between container restarts.
* **`showtime_redisdata`**: Persists in-memory Redis keys and snapshot dumps.

To completely reset the database to a fresh state with automatic seed re-execution:
```bash
docker compose down -v
docker compose up -d --build
```

