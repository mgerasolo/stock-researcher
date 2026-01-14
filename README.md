# stock-researcher

Stock seasonality analysis tool with interactive heatmaps showing historical monthly performance patterns. Helps identify historically favorable entry/exit months for stocks.

> ⚠️ **DEPLOYMENT TARGET: Banner (10.0.0.33)** - NOT localhost. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## Status

🚧 **In Development** - MVP complete, enhancements ongoing

## Features

### Core Analysis
- [x] Stock summary header with company info (name, market cap, sector, price)
- [x] Interactive seasonality heatmaps (1, 3, 6, 12 month holding periods)
- [x] Calculation methods: Open→Close (tradeable) and Max→Max (theoretical)
- [x] Entry view (when to buy) and Exit view (when to sell)
- [x] Configurable year range (8, 10, 12, 15, 20 years)

### Metrics & Statistics
- [x] Win Rate - percentage of positive years per entry month
- [x] Trimmed Mean - robust average excluding top 2 and bottom 2 outliers
- [x] Alpha - per-month return vs market benchmark (SPY+DIA average)
- [x] Min/Max returns - downside risk and upside potential
- [x] Metric tooltips explaining each calculation

### Visual Features
- [x] Dynamic color scaling based on per-month return rate
- [x] Outlier detection with severity indicators
- [x] Highlight filters (Win% ≥ X, Avg ≥ Y)
- [x] Cell hover tooltips with entry/exit details

### Navigation
- [x] Best Months panel with click-to-navigate
- [x] Favorites system with localStorage persistence
- [x] Recent searches tracking
- [x] Top Periods cross-stock report
- [x] Stock picker with price display in search results

### Planned
- [ ] Calendar view
- [ ] Advanced screening engine
- [ ] Trend analysis

See [docs/FEATURES.md](docs/FEATURES.md) for complete feature documentation.

## Tech Stack

| Component | Technology | Location |
|-----------|------------|----------|
| Frontend | React + Vite | Banner 10.0.0.33:3382 |
| Backend | Node.js + Express | Banner 10.0.0.33:3381 |
| Database | PostgreSQL 16 | Banner 10.0.0.33:3380 |
| Auth | Authentik | Helicarrier |
| Domain | stock-researcher.nextlevelfoundry.com | Traefik |

## Development

### Local Development (optional)
```bash
# Use the local override file explicitly
docker-compose -f docker-compose.yml -f docker-compose.local.yml up

# Or for quick iteration without Docker:
cd server && npm run dev
cd client && npm run dev
```

### Production Deployment (Banner)
```bash
# Deploy to Banner - see docs/DEPLOYMENT.md for full guide
docker-compose -f docker-compose.yml up -d
```

## Secrets

Secrets are managed via Infrastructure scripts:
```bash
source ~/Infrastructure/scripts/secrets.sh
appservices_get POSTGRES_PASSWORD
```

## Documentation

- [Features Guide](docs/FEATURES.md) - Complete feature documentation and API reference
- [Deployment Guide](docs/DEPLOYMENT.md) - How to deploy to Banner
- [Database Guide](docs/DATABASE.md) - Database location and access
- [Issue Workflow](docs/ISSUE_WORKFLOW.md) - Development workflow and issue tracking
- [CLAUDE.md](CLAUDE.md) - AI agent instructions

## Related

- [Infrastructure](https://github.com/mgerasolo/nlf-infrastructure) - Deployment and secrets management
- [Project Board](https://github.com/users/mgerasolo/projects/X) - Task tracking

## License

Private
