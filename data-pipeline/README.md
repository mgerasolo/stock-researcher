# Stock Researcher Data Pipeline

Fetches historical stock price data from Yahoo Finance using yfinance.

## Setup

```bash
# Create virtual environment
cd data-pipeline
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

## Usage

### Fetch Tier 1 stocks (priority list with Excel references)
```bash
python fetch_historical.py --tier 1
```

### Fetch single stock
```bash
python fetch_historical.py --ticker AAPL
```

### Fetch with monthly aggregates
```bash
python fetch_historical.py --tier 1 --monthly
```

### Fetch all Tier 1+2 stocks
```bash
python fetch_historical.py --all
```

### Fetch S&P 500 stocks (Tier 3 - 503 stocks)
```bash
python fetch_historical.py --sp500
# or equivalently:
python fetch_historical.py --tier 3
```

### Fetch ALL major stocks (~540 stocks)
```bash
python fetch_historical.py --all-major
```

## Data Output

- **Daily CSV**: `daily_prices_YYYYMMDD_HHMMSS.csv`
  - Columns: ticker, date, open, high, low, close, volume
  - All prices are split-adjusted

- **Monthly CSV** (with --monthly flag): `daily_prices_YYYYMMDD_HHMMSS_monthly.csv`
  - Columns: ticker, year, month, open_first, high_max, low_min, close_last, volume_total, trading_days
  - `high_max` is the key column for heatmap analysis

## Database Schema

See `schema.sql` for PostgreSQL table definitions.

```bash
# Apply schema
psql -d stock_researcher -f schema.sql
```

## Stock Tiers

**Tier 1 (16 stocks)**: Priority list, includes stocks with Excel reference files for validation
- AAPL, TSLA, AMZN, MSFT, GOOGL, NVDA, RCL, ASML, AMD, WMT, SBUX, NFLX, COIN, DAKT, KEN, CVX

**Tier 2 (~70 stocks)**: From portfolio watchlist, import after Tier 1 validated

**Tier 3 (503 stocks)**: S&P 500 - most actively traded US stocks
- Covers ~80% of US market capitalization
- Source: [SlickCharts S&P 500](https://www.slickcharts.com/sp500)
- See `sp500_stocks.py` for full list

**All-Major (~540 stocks)**: S&P 500 + additional high-volume non-S&P stocks
- Includes popular growth stocks: SHOP, RIVN, NIO, SNOW, etc.
- Includes major international ADRs: TSM, BABA, ASML, etc.

## Notes

- Data fetched from 2010 onwards by default
- Some stocks (COIN, KEN, RIVN, HOOD) have limited history due to recent IPOs
- yfinance is free with no API key required
- Built-in 1-second delay between fetches to be a good citizen
