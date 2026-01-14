#!/usr/bin/env python3
"""
Fetch stock data from yfinance API and load directly into PostgreSQL.
"""

import os
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import execute_values
import yfinance as yf
import pandas as pd
from config import TIER_1_STOCKS, TIER_2_STOCKS

def get_connection():
    """Get database connection.

    IMPORTANT: Defaults to Banner (10.0.0.33:3380), NOT localhost.
    Set DB_HOST/DB_PORT env vars to override for local development.
    """
    return psycopg2.connect(
        host=os.getenv('DB_HOST', '10.0.0.33'),
        port=os.getenv('DB_PORT', '3380'),
        database=os.getenv('DB_NAME', 'stock_researcher'),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD', 'localdev')
    )

def load_stocks(conn, tier1_stocks, tier2_stocks):
    """Insert stock metadata into stocks table."""
    cur = conn.cursor()

    for ticker in tier1_stocks:
        cur.execute("""
            INSERT INTO stocks (ticker, name, tier)
            VALUES (%s, %s, 1)
            ON CONFLICT (ticker) DO UPDATE SET tier = 1
        """, (ticker, ticker))

    for ticker in tier2_stocks:
        cur.execute("""
            INSERT INTO stocks (ticker, name, tier)
            VALUES (%s, %s, 2)
            ON CONFLICT (ticker) DO UPDATE SET tier = 2
        """, (ticker, ticker))

    conn.commit()
    print(f"✓ Loaded {len(tier1_stocks)} Tier 1 + {len(tier2_stocks)} Tier 2 stocks")

def fetch_and_load_prices(conn, tickers, years=26):
    """Fetch from yfinance API and load monthly prices into PostgreSQL."""
    cur = conn.cursor()

    end_date = datetime.now()
    start_date = end_date - timedelta(days=years * 365)

    total_records = 0

    for ticker in tickers:
        print(f"  Fetching {ticker} from yfinance API...", end=" ", flush=True)

        try:
            # Fetch from yfinance API
            stock = yf.Ticker(ticker)
            df = stock.history(start=start_date, end=end_date, auto_adjust=True)

            if df.empty:
                print("no data")
                continue

            # Aggregate to monthly with all relevant metrics
            df['Year'] = df.index.year
            df['Month'] = df.index.month

            # Get first and last values per month
            monthly = df.groupby(['Year', 'Month']).agg({
                'Open': 'first',    # open_first: first day's open
                'High': 'max',      # high_max: max high of month
                'Low': 'min',       # low_min: min low of month
                'Close': ['max', 'last'],  # close_max, close_last
                'Volume': 'sum'     # volume_total
            })

            # Flatten column names
            monthly.columns = ['open_first', 'high_max', 'low_min', 'close_max', 'close_last', 'volume_total']
            monthly = monthly.reset_index()

            # Count trading days per month
            trading_days = df.groupby(['Year', 'Month']).size().reset_index(name='trading_days')
            monthly = monthly.merge(trading_days, on=['Year', 'Month'])

            # Prepare for insert
            rows = [
                (
                    ticker,
                    int(row['Year']),
                    int(row['Month']),
                    float(row['close_max']),
                    float(row['open_first']),
                    float(row['high_max']),
                    float(row['low_min']),
                    float(row['close_last']),
                    int(row['volume_total']),
                    int(row['trading_days'])
                )
                for _, row in monthly.iterrows()
            ]

            # Bulk upsert with all columns
            execute_values(cur, """
                INSERT INTO monthly_prices (ticker, year, month, close_max, open_first, high_max, low_min, close_last, volume_total, trading_days)
                VALUES %s
                ON CONFLICT (ticker, year, month)
                DO UPDATE SET
                    close_max = EXCLUDED.close_max,
                    open_first = EXCLUDED.open_first,
                    high_max = EXCLUDED.high_max,
                    low_min = EXCLUDED.low_min,
                    close_last = EXCLUDED.close_last,
                    volume_total = EXCLUDED.volume_total,
                    trading_days = EXCLUDED.trading_days,
                    updated_at = NOW()
            """, rows)

            conn.commit()
            total_records += len(rows)
            print(f"{len(rows)} months")

        except Exception as e:
            print(f"error: {e}")
            continue

    return total_records

def load_single_ticker(conn, ticker, tier=0):
    """Load a single ticker with specified tier (0 = benchmark)."""
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO stocks (ticker, name, tier)
        VALUES (%s, %s, %s)
        ON CONFLICT (ticker) DO UPDATE SET tier = %s
    """, (ticker, ticker, tier, tier))
    conn.commit()

def main():
    import sys

    # Check for command line arguments
    if len(sys.argv) > 1:
        # Load specific tickers passed as arguments
        tickers = [t.upper() for t in sys.argv[1:]]
        print(f"🔌 Connecting to PostgreSQL...")
        conn = get_connection()

        try:
            print(f"\n📊 Loading {len(tickers)} ticker(s): {', '.join(tickers)}")
            for ticker in tickers:
                load_single_ticker(conn, ticker, tier=0)  # tier 0 = benchmark/custom

            print("\n📈 Fetching from yfinance API (26 years, back to 2000)...")
            records = fetch_and_load_prices(conn, tickers, years=26)

            print(f"\n✅ Loaded {records} monthly records for {len(tickers)} ticker(s)")

        finally:
            conn.close()
        return

    # Default behavior - load Tier 1
    print("🔌 Connecting to PostgreSQL...")
    conn = get_connection()

    try:
        # Load stock metadata
        print("\n📊 Loading stock metadata...")
        load_stocks(conn, TIER_1_STOCKS, [])  # Only Tier 1 for MVP

        # Fetch from yfinance and load
        print("\n📈 Fetching from yfinance API (26 years, back to 2000)...")
        records = fetch_and_load_prices(conn, TIER_1_STOCKS, years=26)

        # Verify
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM stocks WHERE tier = 1")
        stock_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM monthly_prices")
        price_count = cur.fetchone()[0]

        print(f"\n✅ Database loaded!")
        print(f"   Stocks: {stock_count}")
        print(f"   Monthly prices: {price_count}")

    finally:
        conn.close()

if __name__ == '__main__':
    main()
