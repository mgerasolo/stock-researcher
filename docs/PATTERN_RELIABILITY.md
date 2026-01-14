# Pattern Reliability Analysis

> **Related Issue:** [#31 - Pattern reliability analysis](https://github.com/mgerasolo/stock-researcher/issues/31)

This document tracks observations about when seasonality patterns fail to predict actual performance. The goal is to collect real-world examples for future AI-assisted analysis.

---

## Case Studies

### 1. TTD (The Trade Desk) - January 2025

**Date Observed:** 2026-01-13

| Metric | Historical | 2025 Actual |
|--------|------------|-------------|
| Win Rate | 78% (7/9 years) | Loss |
| Avg/Mo | +17.91% | -3.2% |
| Alpha | +16.20% | - |

**Context:**
- Stock declined ~70% from 52-week high ($126 → $37)
- Major fundamental shift in company outlook
- Pattern had been reliable for 7 of 9 years

**Hypothesis:**
- Severe downtrend invalidated historical seasonality
- Momentum overwhelmed seasonal patterns
- Possible structural change in company/sector

**Questions Raised:**
- At what point does a downtrend invalidate seasonality?
- Should recent years be weighted more heavily?
- Does the magnitude of decline matter (e.g., 30% vs 70%)?

---

## Patterns to Watch

| Ticker | Month | Historical Win% | Concern | Status |
|--------|-------|-----------------|---------|--------|
| TTD | January | 78% | 70% off highs, failed 2025 | Confirmed failure |

---

## Potential Red Flags (Hypotheses)

These are unvalidated theories about what might indicate pattern unreliability:

1. **Distance from 52-week high**
   - >40% below high may indicate broken pattern
   - Needs more data points to validate

2. **Recent trend direction**
   - Consecutive negative months/quarters
   - Breaking long-term support levels

3. **Fundamental changes**
   - Earnings misses
   - Guidance cuts
   - Sector rotation

4. **Market regime**
   - Bull vs bear market performance
   - High volatility environments

---

## Future Analysis Questions

For AI integration:

1. What % of patterns fail when stock is >X% below 52W high?
2. Do certain sectors have more reliable patterns?
3. Does market cap affect pattern reliability?
4. Are patterns more reliable in certain market conditions?
5. Should we weight recent years more heavily?
6. What combination of factors best predicts pattern failure?

---

## How to Add Cases

When you observe a pattern failure:

1. Add a new "Case Study" section with:
   - Ticker and time period
   - Historical metrics vs actual results
   - Context (price action, news, market conditions)
   - Your hypothesis for why it failed

2. Update the "Patterns to Watch" table

3. Note any new questions or hypotheses raised

---

*Last updated: 2026-01-13*
