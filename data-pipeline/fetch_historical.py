#!/usr/bin/env python3
"""
Historical Stock Data Fetcher

Fetches daily OHLC data from Yahoo Finance using yfinance library.
Data is split-adjusted by default (auto_adjust=True).

Usage:
    python fetch_historical.py --tier 1        # Fetch Tier 1 stocks only
    python fetch_historical.py --tier 2        # Fetch Tier 2 stocks only
    python fetch_historical.py --ticker AAPL   # Fetch single stock
    python fetch_historical.py --all           # Fetch all stocks
"""

import argparse
import time
from datetime import datetime, date
from typing import Optional

import pandas as pd
import yfinance as yf

from config import (
    TIER_1_STOCKS,
    TIER_2_STOCKS,
    START_DATE,
    END_DATE,
    DELAY_BETWEEN_FETCHES,
)


def fetch_stock_data(
    ticker: str,
    start_date: str = START_DATE,
    end_date: Optional[str] = END_DATE
) -> pd.DataFrame:
    """
    Fetch historical daily OHLC data for a single stock.

    Args:
        ticker: Stock symbol (e.g., 'AAPL')
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format (None = today)

    Returns:
        DataFrame with columns: Date, Open, High, Low, Close, Volume
        All prices are split-adjusted (auto_adjust=True is default)
    """
    print(f"Fetching {ticker}...")

    try:
        # Create ticker object
        stock = yf.Ticker(ticker)

        # Download historical data
        # auto_adjust=True is default - gives split-adjusted prices
        df = stock.history(
            start=start_date,
            end=end_date,
            auto_adjust=True,  # Split-adjusted prices
            actions=False,      # Don't include dividends/splits columns
        )

        if df.empty:
            print(f"  WARNING: No data returned for {ticker}")
            return pd.DataFrame()

        # Reset index to make Date a column
        df = df.reset_index()

        # Rename columns for consistency
        df = df.rename(columns={
            'Date': 'date',
            'Open': 'open',
            'High': 'high',
            'Low': 'low',
            'Close': 'close',
            'Volume': 'volume',
        })

        # Add ticker column
        df['ticker'] = ticker

        # Convert date to date only (remove time component)
        df['date'] = pd.to_datetime(df['date']).dt.date

        # Select and order columns
        df = df[['ticker', 'date', 'open', 'high', 'low', 'close', 'volume']]

        print(f"  Fetched {len(df)} days from {df['date'].min()} to {df['date'].max()}")

        return df

    except Exception as e:
        print(f"  ERROR fetching {ticker}: {e}")
        return pd.DataFrame()


def fetch_multiple_stocks(
    tickers: list[str],
    start_date: str = START_DATE,
    end_date: Optional[str] = END_DATE,
    delay: float = DELAY_BETWEEN_FETCHES,
) -> pd.DataFrame:
    """
    Fetch historical data for multiple stocks.

    Args:
        tickers: List of stock symbols
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format (None = today)
        delay: Seconds to wait between API calls

    Returns:
        Combined DataFrame with all stocks' data
    """
    all_data = []
    success_count = 0
    error_count = 0

    print(f"\nFetching {len(tickers)} stocks from {start_date} to {end_date or 'today'}...")
    print("=" * 60)

    for i, ticker in enumerate(tickers, 1):
        print(f"\n[{i}/{len(tickers)}] ", end="")

        df = fetch_stock_data(ticker, start_date, end_date)

        if not df.empty:
            all_data.append(df)
            success_count += 1
        else:
            error_count += 1

        # Rate limiting - be a good citizen
        if i < len(tickers):
            time.sleep(delay)

    print("\n" + "=" * 60)
    print(f"Completed: {success_count} successful, {error_count} errors")

    if all_data:
        combined = pd.concat(all_data, ignore_index=True)
        print(f"Total rows: {len(combined)}")
        return combined

    return pd.DataFrame()


def save_to_csv(df: pd.DataFrame, filename: str) -> None:
    """Save DataFrame to CSV file."""
    if df.empty:
        print("No data to save")
        return

    df.to_csv(filename, index=False)
    print(f"\nSaved to {filename}")


def aggregate_to_monthly(df: pd.DataFrame) -> pd.DataFrame:
    """
    Aggregate daily data to monthly values (for heatmap).

    Key column: close_max = MAX of CLOSE price per month
    This matches the Excel "MAX of Close Last for the Month" metric.
    """
    if df.empty:
        return pd.DataFrame()

    # Convert date to datetime for grouping
    df = df.copy()
    df['date'] = pd.to_datetime(df['date'])
    df['year'] = df['date'].dt.year
    df['month'] = df['date'].dt.month

    # Aggregate by ticker, year, month
    monthly = df.groupby(['ticker', 'year', 'month']).agg({
        'open': 'first',       # First open of month
        'high': 'max',         # MAX high
        'low': 'min',          # MIN low
        'close': ['max', 'last'],  # MAX close (for heatmap) AND last close
        'volume': 'sum',       # Total volume
        'date': 'count',       # Trading days count
    }).reset_index()

    # Flatten multi-level columns
    monthly.columns = ['ticker', 'year', 'month', 'open_first', 'high_max',
                       'low_min', 'close_max', 'close_last', 'volume_total', 'trading_days']

    return monthly


def main():
    parser = argparse.ArgumentParser(description='Fetch historical stock data')
    parser.add_argument('--tier', type=int, choices=[1, 2], help='Fetch stocks by tier')
    parser.add_argument('--ticker', type=str, help='Fetch single ticker')
    parser.add_argument('--all', action='store_true', help='Fetch all stocks')
    parser.add_argument('--start', type=str, default=START_DATE, help='Start date (YYYY-MM-DD)')
    parser.add_argument('--end', type=str, default=END_DATE, help='End date (YYYY-MM-DD)')
    parser.add_argument('--output', type=str, help='Output CSV filename')
    parser.add_argument('--monthly', action='store_true', help='Also generate monthly aggregates')

    args = parser.parse_args()

    # Determine which tickers to fetch
    if args.ticker:
        tickers = [args.ticker.upper()]
    elif args.tier == 1:
        tickers = TIER_1_STOCKS
    elif args.tier == 2:
        tickers = TIER_2_STOCKS
    elif args.all:
        tickers = TIER_1_STOCKS + TIER_2_STOCKS
    else:
        # Default to Tier 1
        print("No tier specified, defaulting to Tier 1 stocks")
        tickers = TIER_1_STOCKS

    # Fetch data
    df = fetch_multiple_stocks(tickers, args.start, args.end)

    if df.empty:
        print("No data fetched")
        return

    # Save daily data
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    daily_filename = args.output or f"daily_prices_{timestamp}.csv"
    save_to_csv(df, daily_filename)

    # Optionally generate monthly aggregates
    if args.monthly:
        monthly_df = aggregate_to_monthly(df)
        monthly_filename = daily_filename.replace('.csv', '_monthly.csv')
        save_to_csv(monthly_df, monthly_filename)


if __name__ == '__main__':
    main()
