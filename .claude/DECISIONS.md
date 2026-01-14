# Architecture Decisions

Track architectural and technical decisions, tagged with conversation ID.

## Format

**Conv:** conv-YYYYMMDD-HHMMSS
**Decision:** Description
**Rationale:** Why this decision was made
**Date:** YYYY-MM-DD

---

## Decisions

### Alpha Calculation Method

**Conv:** conv-20250113
**Decision:** Alpha calculated as per-month return difference, not total return difference
**Rationale:** Makes alpha comparable across different holding periods. A +1% alpha for 3-month holding means the same thing as +1% alpha for 12-month holding - both indicate 1% monthly outperformance vs market.
**Date:** 2025-01-13

### Benchmark Selection

**Conv:** conv-20250113
**Decision:** Use average of SPY and DIA as market benchmark for alpha
**Rationale:** SPY tracks S&P 500 (large-cap), DIA tracks Dow Jones (blue-chip). Averaging provides a balanced market representation. Both have long history and high liquidity.
**Date:** 2025-01-13

### Trimmed Mean for Avg/Mo

**Conv:** conv-20250113
**Decision:** Use trimmed mean (exclude top 2 and bottom 2) for the primary Avg/Mo* display
**Rationale:** Single outlier years (like 2020 pandemic recovery) can dramatically skew averages and give misleading signals. Trimmed mean provides a more reliable central tendency while still showing outlier warnings separately.
**Date:** 2025-01-13

### Default Years Changed to 12

**Conv:** conv-20250113
**Decision:** Changed default years from 10 to 12
**Rationale:** 12 years provides more statistical significance for the trimmed mean calculation (needs at least 5 data points after removing 4 outliers). Also captures a full market cycle.
**Date:** 2025-01-13

### Holding Period Calculation for Open-to-Close

**Conv:** conv-20250112
**Decision:** For Open-to-Close method, actual holding is period + 1 months
**Rationale:** When you buy at January open and hold for "3 months", you sell at April close. That's actually 4 calendar months of exposure (Jan, Feb, Mar, Apr). Per-month calculations need to reflect this.
**Date:** 2025-01-12

### Color Scale Based on Per-Month Returns

**Conv:** conv-20250112
**Decision:** Cell colors based on return per month (total / holding months), not total return
**Rationale:** A 20% return over 12 months (~1.7%/mo) is less impressive than 10% over 3 months (~3.3%/mo). Per-month coloring makes comparisons across timeframes meaningful.
**Date:** 2025-01-12

### Outlier Detection Thresholds

**Conv:** conv-20250112
**Decision:** Use both multiplier (5x/7x/10x) AND z-score (2/2.5/3 std devs) for outlier detection
**Rationale:** Multiplier alone can flag false positives when baseline is low. Z-score alone misses obvious outliers. Requiring both ensures only truly extreme values are flagged.
**Date:** 2025-01-12

### Database on Banner, Not Local

**Conv:** conv-20250111
**Decision:** PostgreSQL runs on Banner (10.0.0.33:3380), not localhost
**Rationale:** Consistent with infrastructure standards. Allows data persistence across development sessions. Enables collaboration without database sync issues.
**Date:** 2025-01-11
