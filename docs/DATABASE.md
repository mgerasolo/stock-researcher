# Database Guide

The PostgreSQL database runs **ON BANNER**, not localhost.

> ⚠️ **NEVER connect to localhost for production data.** The database is on Banner.

## Connection Details

| Property | Value |
|----------|-------|
| **Host** | `10.0.0.33` (external) or `db` (within Docker network) |
| **Port** | `3380` (external) / `5432` (internal) |
| **Database** | `stock_researcher` |
| **User** | `postgres` |
| **Password** | Get via `appservices_get POSTGRES_PASSWORD` |

### Connection String

```
postgresql://postgres:PASSWORD@10.0.0.33:3380/stock_researcher
```

### From Application Code

Within Docker containers, use the service name:
```
DB_HOST=db
DB_PORT=5432
```

From external connections (psql, database tools):
```
DB_HOST=10.0.0.33
DB_PORT=3380
```

## Getting the Password

```bash
source ~/Infrastructure/scripts/secrets.sh
appservices_get POSTGRES_PASSWORD
```

## Connecting with psql

```bash
# From any machine with network access to Banner
psql -h 10.0.0.33 -p 3380 -U postgres -d stock_researcher
```

## Schema Overview

### Core Tables

| Table | Purpose |
|-------|---------|
| `stocks` | Stock metadata (ticker, name, sector, tier) |
| `daily_prices` | Historical OHLC data by day |
| `monthly_prices` | Pre-aggregated monthly data for heatmaps |
| `fetch_log` | Import tracking |
| `stock_events` | Corporate actions, earnings, etc. |
| `market_events` | Market-wide events (crashes, fed actions) |

### Key Indexes

- `idx_daily_prices_ticker_date` - Fast ticker/date lookups
- `idx_monthly_prices_ticker_year` - Fast monthly data access
- `idx_stock_events_ticker` - Event lookups by stock

### Views

- `v_stock_summary` - Quick overview of data coverage per stock

## Schema File

The full schema is in [data-pipeline/schema.sql](../data-pipeline/schema.sql).

To apply schema changes:
```bash
# From within the db container
docker-compose -f docker-compose.yml exec db psql -U postgres -d stock_researcher -f /docker-entrypoint-initdb.d/01-schema.sql

# Or from external
psql -h 10.0.0.33 -p 3380 -U postgres -d stock_researcher -f data-pipeline/schema.sql
```

## Common Queries

### Check data coverage
```sql
SELECT * FROM v_stock_summary ORDER BY ticker;
```

### Get monthly data for heatmap
```sql
SELECT ticker, year, month, open_first, close_last,
       ((close_last - open_first) / open_first * 100) as return_pct
FROM monthly_prices
WHERE ticker = 'AAPL'
ORDER BY year, month;
```

### Check recent imports
```sql
SELECT * FROM fetch_log
ORDER BY fetch_date DESC
LIMIT 20;
```

## Backups

Database backups are managed by Infrastructure. Contact Infrastructure team for backup/restore procedures.

## Local Development

For local development, you can run a local PostgreSQL:

```bash
# Start local database only
docker-compose -f docker-compose.local.yml up -d

# Connect locally
psql -h localhost -p 5432 -U postgres -d stock_researcher
```

**Important:** Local databases do NOT have production data. Use for development/testing only.

## Troubleshooting

### Can't connect to database

1. Verify you're connecting to Banner, not localhost:
   ```bash
   # WRONG
   psql -h localhost -p 5432 ...

   # CORRECT
   psql -h 10.0.0.33 -p 3380 ...
   ```

2. Check database container is running:
   ```bash
   docker-compose -f docker-compose.yml ps db
   ```

3. Check firewall/network access to Banner

### Data seems old/missing

1. Check fetch_log for import status:
   ```sql
   SELECT * FROM fetch_log WHERE ticker = 'AAPL' ORDER BY fetch_date DESC LIMIT 5;
   ```

2. Run data pipeline to refresh (see data-pipeline README)

## Related

- [Deployment Guide](DEPLOYMENT.md)
- [CLAUDE.md](../CLAUDE.md) - AI agent instructions
- [Schema File](../data-pipeline/schema.sql)
