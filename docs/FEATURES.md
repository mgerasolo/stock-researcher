# Features Documentation

Complete feature reference for the Stock Researcher application.

## Overview

Stock Researcher is a seasonality analysis tool that helps identify historically favorable entry/exit months for stocks. It analyzes years of historical data to find patterns in monthly returns.

---

## Core Features

### 1. Seasonality Heatmaps

Interactive heatmaps showing historical monthly performance patterns.

**Location:** Main search page after selecting a ticker

**Holding Periods:**
- 1-month returns
- 3-month returns (default expanded)
- 6-month returns
- 12-month returns

**View Modes:**
- **Entry View:** Shows which month to BUY for the holding period
- **Exit View:** Shows which month the position EXITS

**Calculation Methods:**
- **Open→Close:** Buy at month's open price, sell at exit month's close price (more realistic, tradeable)
- **Max→Max:** Compare peak prices within entry and exit months (theoretical maximum)

### 2. Summary Metrics

Each heatmap displays key statistics for each entry month:

| Metric | Description |
|--------|-------------|
| **Win %** | Percentage of years with positive returns for this entry month |
| **Avg/Mo*** | Average return per month using trimmed mean (excludes top 2 and bottom 2 outlier years for reliability) |
| **Alpha** | Per-month outperformance vs market benchmark (SPY+DIA average). Positive = beating the market |
| **Avg** | Simple average total return (includes all outliers) |
| **Min** | Worst historical return - shows downside risk |
| **Max** | Best historical return - shows upside potential |

**Tooltips:** All metrics have hover tooltips explaining their meaning.

### 3. Alpha Calculation

Measures stock performance relative to the market.

**Benchmark:** Average of SPY and DIA returns for the same holding period

**Formula:**
```
Alpha = (Stock Avg Return / Holding Months) - (Market Avg Return / Holding Months)
```

**Color Coding:**
- Green (≥ +0.5%): Outperforming market
- Gray (-0.5% to +0.5%): Neutral
- Red (≤ -0.5%): Underperforming market

### 4. Trimmed Mean

More robust average that reduces the impact of extreme outliers.

**Method:** Removes the top 2 and bottom 2 returns before calculating average

**When Used:** Displayed in the "Avg/Mo*" row (asterisk indicates trimmed)

**Fallback:** If fewer than 5 data points, uses simple average instead

### 5. Outlier Detection

Flags months where a single year significantly skews the average.

**Indicators:**
- `‼️` Severe outlier (10x+ multiplier AND 3+ std devs)
- `❗` High outlier (7x+ multiplier AND 2.5+ std devs)
- `⚠️` Moderate outlier (5x+ multiplier AND 2+ std devs)

**Tooltip:** Hover shows the outlier year, value, and comparison to other years

### 6. Cell Hover Details

Hovering on any return cell shows:
- Entry date and price
- Exit date and price
- Total return percentage and dollar amount
- Price type based on calculation method (Open/Close vs Max/Max)

### 7. Dynamic Color Scaling

Return cells are colored based on per-month return rate:

**Scale:** 1.25% per month per color step

**Colors:**
- Dark green: Strong positive (5+ steps)
- Light green: Moderate positive
- Gray: Neutral (0% to +0.625%/mo)
- Light red: Moderate negative
- Dark red: Strong negative (5+ steps)

### 8. Stock Summary Header

Displays company information above the seasonality heatmaps for context.

**Data Source:** Yahoo Finance (real-time)

**Information Displayed:**
- **Company Name:** Full legal name (e.g., "Apple Inc.")
- **Market Cap:** Human-readable format ($XXB, $XXM, $XXT)
- **Sector/Industry:** Business classification (e.g., "Technology • Consumer Electronics")
- **Current Price:** Real-time price with daily change ($ and %)
- **52-Week Range:** Low to high price range
- **Description:** Collapsible company description

**Caching:** 15-minute cache to prevent excessive API calls

**Fallback:** Graceful degradation if Yahoo Finance data unavailable

---

## Navigation & Filtering

### 9. Years Selection

Choose how many years of historical data to display:
- 8, 10, 12 (default), 15, or 20 years

### 10. Highlight Filters

Set criteria to highlight favorable months:
- **Win% ≥** threshold (default: 60%)
- **Avg ≥** threshold (default: 5%)

Matching months are highlighted with purple border

### 11. Best Months Panel

Right-side drawer showing top-performing entry months for the selected ticker.

**Ranking:** Based on combination of win rate and average return

**Click-to-Navigate:** Click any entry to jump to that heatmap with the month highlighted

---

## Reports & Screening

### 12. Top Periods Report

Cross-stock analysis showing the best entry periods across all tracked stocks.

**Columns:** Ticker, Entry Month, Holding Period, Win %, Avg Return

**Sorting:** By combined score of win rate and return

### 13. Upcoming Entries

Shows which stocks have favorable entry windows in the current or upcoming months.

---

## Data Management

### 14. Stock Universe

**Tier 1 (Priority):** AAPL, TSLA, AMZN, MSFT, GOOGL, NVDA, RCL, ASML, AMD, WMT, SBUX, NFLX, COIN, DAKT, KEN, CVX

**Tier 2 (Extended):** 70+ additional stocks from portfolio

**Benchmarks:** SPY, DIA (used for alpha calculation)

### 15. Data Pipeline

Python scripts fetch historical data from Yahoo Finance:
- Daily OHLC prices (split-adjusted)
- Aggregated to monthly: open_first, close_last, close_max, high_max, low_min

---

## User Features

### 16. Favorites

Add tickers to favorites for quick access (persisted in localStorage)

### 17. Recent Searches

Tracks last 10 searched tickers for quick re-access

### 18. Max Close Grid

Separate expandable section showing raw monthly max close prices (for manual analysis)

---

## API Reference

### GET /api/prices/:ticker/heatmap

Returns heatmap data with calculated returns and aggregates.

**Query Parameters:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `period` | 3 | Holding period in months (1, 3, 6, 12) |
| `years` | 12 | Years of data to include |
| `view` | exit | View mode (entry or exit) |
| `calcMethod` | openClose | Calculation method (openClose or maxMax) |

**Response:**
```json
{
  "ticker": "AAPL",
  "holdingPeriod": 3,
  "viewMode": "entry",
  "calcMethod": "openClose",
  "years": 12,
  "data": [...],  // Individual cell data
  "aggregates": [
    {
      "month": 1,
      "win_rate": 85,
      "avg_return": 7.18,
      "min_return": -12.5,
      "max_return": 45.2,
      "count": 12,
      "alpha": 1.15,
      "market_return": 2.56
    }
  ],
  "lastUpdated": "2025-01-13T..."
}
```

### GET /api/stock-info/:ticker

Returns real-time company information from Yahoo Finance.

**Response:**
```json
{
  "ticker": "AAPL",
  "name": "Apple Inc.",
  "marketCap": 3857366646784,
  "marketCapFormatted": "$3.86T",
  "sector": "Technology",
  "industry": "Consumer Electronics",
  "currentPrice": 261.05,
  "priceChange": 0.80,
  "priceChangePercent": 0.31,
  "fiftyTwoWeekHigh": 288.62,
  "fiftyTwoWeekLow": 169.21,
  "description": "Apple Inc. designs, manufactures...",
  "exchange": "NMS",
  "currency": "USD",
  "fetchedAt": "2025-01-14T..."
}
```

**Caching:** Responses cached for 15 minutes

---

## Technical Architecture

- **Frontend:** React + TypeScript + Vite + TailwindCSS
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL 16
- **Deployment:** Docker Compose on Banner (10.0.0.33)
- **Domain:** stock-researcher.nextlevelfoundry.com

---

## Version History

| Date | Feature |
|------|---------|
| 2025-01-14 | Added Stock Summary header with company info from Yahoo Finance |
| 2025-01-13 | Added Alpha metric (return vs market) |
| 2025-01-13 | Added trimmed mean for Avg/Mo |
| 2025-01-13 | Added tooltips to all metrics |
| 2025-01-13 | Changed default years from 10 to 12 |
| 2025-01-12 | Outlier detection and warnings |
| 2025-01-12 | Dynamic color scaling |
| 2025-01-11 | Initial heatmap implementation |
