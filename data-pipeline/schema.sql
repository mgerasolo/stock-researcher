-- Stock Researcher Database Schema
-- Historical stock price data for seasonality analysis

-- Stock metadata table
CREATE TABLE IF NOT EXISTS stocks (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(255),
    sector VARCHAR(100),
    industry VARCHAR(100),
    ipo_date DATE,
    tier INTEGER DEFAULT 1,  -- 1 = priority, 2 = secondary
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily OHLC price data (split-adjusted)
CREATE TABLE IF NOT EXISTS daily_prices (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    open DECIMAL(12, 4),
    high DECIMAL(12, 4),
    low DECIMAL(12, 4),
    close DECIMAL(12, 4),
    volume BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(ticker, date)
);

-- Index for fast lookups by ticker and date range
CREATE INDEX IF NOT EXISTS idx_daily_prices_ticker_date
ON daily_prices(ticker, date DESC);

-- Monthly aggregated data (precomputed for heatmap performance)
CREATE TABLE IF NOT EXISTS monthly_prices (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    close_max DECIMAL(12, 4),        -- Max close price of the month (for seasonality calc)
    open_first DECIMAL(12, 4),       -- First trading day open
    high_max DECIMAL(12, 4),         -- Max high of the month
    low_min DECIMAL(12, 4),          -- Min low of the month
    close_last DECIMAL(12, 4),       -- Last trading day close
    volume_total BIGINT,             -- Total volume for month
    trading_days INTEGER,            -- Number of trading days
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(ticker, year, month)
);

-- Index for fast monthly lookups
CREATE INDEX IF NOT EXISTS idx_monthly_prices_ticker_year
ON monthly_prices(ticker, year DESC, month);

-- Data fetch log (track what's been imported)
CREATE TABLE IF NOT EXISTS fetch_log (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    fetch_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    start_date DATE,
    end_date DATE,
    rows_fetched INTEGER,
    status VARCHAR(20),  -- 'success', 'partial', 'error'
    error_message TEXT,

    UNIQUE(ticker, fetch_date)
);

-- Stock Events Log (corporate actions, company events)
-- Tracks: symbol changes, splits, mergers, delistings, warrants, spin-offs
-- Also tracks: recurring events like WWDC, Prime Day, earnings
CREATE TABLE IF NOT EXISTS stock_events (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,           -- Stock affected (or 'ALL' for market-wide)
    event_type VARCHAR(50) NOT NULL,       -- Type category (see below)
    event_date DATE NOT NULL,              -- When it happened/happens
    end_date DATE,                         -- For date ranges (e.g., earnings season)
    title VARCHAR(255) NOT NULL,           -- Short description
    description TEXT,                      -- Detailed notes

    -- For corporate actions
    old_ticker VARCHAR(10),                -- Previous symbol (for symbol changes)
    new_ticker VARCHAR(10),                -- New symbol (for symbol changes)
    ratio VARCHAR(20),                     -- Split ratio (e.g., "2:1", "1:10")

    -- For recurring events
    is_recurring BOOLEAN DEFAULT FALSE,    -- Annual event like WWDC?
    recurrence_month INTEGER,              -- Which month (1-12)
    recurrence_week INTEGER,               -- Which week of month (1-4, or -1 for last)

    -- Metadata
    source VARCHAR(255),                   -- Where we learned this (URL, etc.)
    impact VARCHAR(20),                    -- 'high', 'medium', 'low'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Event type categories:
-- Corporate Actions: 'symbol_change', 'stock_split', 'reverse_split', 'merger',
--                    'acquisition', 'spinoff', 'delisting', 'ipo', 'spac_merger',
--                    'warrant_distribution', 'warrant_exercise', 'dividend'
-- Company Events:    'earnings', 'product_launch', 'conference', 'annual_meeting'
-- Recurring:         'wwdc', 'prime_day', 'iphone_launch', 'earnings_q1', etc.

CREATE INDEX IF NOT EXISTS idx_stock_events_ticker ON stock_events(ticker);
CREATE INDEX IF NOT EXISTS idx_stock_events_date ON stock_events(event_date);
CREATE INDEX IF NOT EXISTS idx_stock_events_type ON stock_events(event_type);

-- Market Events Log (global events affecting all stocks)
-- Tracks: pandemics, tariff wars, fed actions, crashes, black swan events
CREATE TABLE IF NOT EXISTS market_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,       -- 'pandemic', 'tariff', 'fed_rate', 'crash', 'geopolitical'
    event_date DATE NOT NULL,              -- Start date
    end_date DATE,                         -- End date (NULL if ongoing or single-day)
    title VARCHAR(255) NOT NULL,           -- "COVID-19 Pandemic", "Trump Tariffs 2.0"
    description TEXT,                      -- Detailed notes, market impact

    -- Impact assessment
    sp500_impact DECIMAL(5, 2),            -- % change in S&P 500
    sectors_affected TEXT[],               -- Array of affected sectors
    impact VARCHAR(20),                    -- 'high', 'medium', 'low'

    -- Metadata
    source VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_market_events_date ON market_events(event_date);
CREATE INDEX IF NOT EXISTS idx_market_events_type ON market_events(event_type);

-- View for easy access to rolling calculations
-- (This is a placeholder - actual calculations will be done in application layer)
CREATE OR REPLACE VIEW v_stock_summary AS
SELECT
    s.ticker,
    s.name,
    s.tier,
    MIN(dp.date) as earliest_date,
    MAX(dp.date) as latest_date,
    COUNT(dp.id) as total_days,
    COUNT(DISTINCT EXTRACT(YEAR FROM dp.date)) as years_of_data
FROM stocks s
LEFT JOIN daily_prices dp ON s.ticker = dp.ticker
GROUP BY s.ticker, s.name, s.tier;

-- ================================================
-- USER PREFERENCES (Single-user system)
-- ================================================

-- Ticker Sentiment (thumbs up/down)
-- No rows = neutral (default state)
CREATE TABLE IF NOT EXISTS ticker_sentiment (
    ticker VARCHAR(10) PRIMARY KEY,
    sentiment VARCHAR(10) NOT NULL CHECK (sentiment IN ('up', 'down')),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pattern Favorites (heart + optional star rating + notes)
CREATE TABLE IF NOT EXISTS pattern_favorites (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    entry_month INTEGER NOT NULL CHECK (entry_month BETWEEN 1 AND 12),
    holding_period INTEGER NOT NULL CHECK (holding_period IN (1, 3, 6, 12)),
    calc_method VARCHAR(20) NOT NULL CHECK (calc_method IN ('openClose', 'maxMax')),
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    note VARCHAR(1000),  -- User notes for the pattern
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ticker, entry_month, holding_period, calc_method)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pattern_favorites_ticker ON pattern_favorites(ticker);
