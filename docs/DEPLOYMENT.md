# Deployment Guide

This application deploys to **Banner (10.0.0.33)** as a Docker Compose stack.

> ⚠️ **NEVER deploy to localhost.** All production deployments go to Banner.

## Quick Reference

| Service | URL |
|---------|-----|
| Production Site | https://stock-researcher.nextlevelfoundry.com |
| Frontend (internal) | http://10.0.0.33:3382 |
| Backend API (internal) | http://10.0.0.33:3381 |
| Database (internal) | postgresql://10.0.0.33:3380 |
| Portainer | https://10.0.0.33:3301 |

## Prerequisites

1. SSH access to Banner (10.0.0.33)
2. Docker and Docker Compose installed
3. Access to secrets via Infrastructure scripts

## Deployment Steps

### 1. Get Database Password

```bash
source ~/Infrastructure/scripts/secrets.sh
appservices_get POSTGRES_PASSWORD
```

### 2. Set Environment Variables

On Banner, create or update `.env` with:

```bash
DB_PASSWORD=<password from step 1>
```

### 3. Deploy

```bash
# SSH to Banner
ssh banner

# Navigate to project
cd /path/to/stock-researcher

# Pull latest changes
git pull

# Deploy (ALWAYS specify the file explicitly)
docker-compose -f docker-compose.yml up -d --build
```

### 4. Verify

```bash
# Check containers are running
docker-compose -f docker-compose.yml ps

# Check logs
docker-compose -f docker-compose.yml logs -f

# Test frontend
curl -I http://10.0.0.33:3382

# Test API
curl http://10.0.0.33:3381/api/health
```

## Docker Compose Files

| File | Purpose | Command |
|------|---------|---------|
| `docker-compose.yml` | **Production** - Banner deployment | `docker-compose -f docker-compose.yml up -d` |
| `docker-compose.local.yml` | Local database only | `docker-compose -f docker-compose.local.yml up -d` |

### WARNING: Auto-Merge Behavior

Docker Compose automatically merges `docker-compose.override.yml` if it exists. This file contains localhost bindings for local development.

**ALWAYS use `-f docker-compose.yml` explicitly** to avoid accidentally deploying with localhost bindings.

```bash
# WRONG - may auto-merge override file
docker-compose up -d

# CORRECT - explicit file specification
docker-compose -f docker-compose.yml up -d
```

## Port Assignments

| Service | External (Banner) | Internal (Container) |
|---------|-------------------|----------------------|
| PostgreSQL | 3380 | 5432 |
| Backend API | 3381 | 3157 |
| Frontend | 3382 | 80 |

## Updating the Application

```bash
# On Banner
cd /path/to/stock-researcher

# Pull changes
git pull

# Rebuild and restart
docker-compose -f docker-compose.yml up -d --build

# If only restarting (no code changes)
docker-compose -f docker-compose.yml restart
```

## Rollback

```bash
# Check recent commits
git log --oneline -10

# Rollback to specific commit
git checkout <commit-hash>

# Rebuild
docker-compose -f docker-compose.yml up -d --build
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose -f docker-compose.yml logs <service-name>

# Check if port is in use
netstat -tlnp | grep 338
```

### Database connection issues

```bash
# Verify database is running
docker-compose -f docker-compose.yml ps db

# Test connection from host
psql -h 10.0.0.33 -p 3380 -U postgres -d stock_researcher

# Test connection from server container
docker-compose -f docker-compose.yml exec server sh -c "nc -zv db 5432"
```

### Frontend can't reach backend

1. Verify CORS_ORIGIN in server environment
2. Check Traefik routing (if using domain)
3. Verify backend is responding: `curl http://10.0.0.33:3381/api/health`

## Monitoring

- **Logs:** Shipped to Loki on Coulson
- **Metrics:** Prometheus scrapes from Coulson
- **Dashboards:** Grafana on Coulson

## Related

- [Database Guide](DATABASE.md)
- [CLAUDE.md](../CLAUDE.md) - AI agent instructions
- [README.md](../README.md) - Project overview
