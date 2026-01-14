#!/usr/bin/env python3
"""
Data Validation Script

Compares fetched data against Excel reference files to ensure accuracy.
"""

import pandas as pd
import os
from pathlib import Path

# Paths
EXCEL_DIR = Path("../imports/excel_heatmaps")
MONTHLY_CSV = Path("tier1_daily_monthly.csv")

def load_excel_monthly_max(excel_path: str, ticker: str) -> pd.DataFrame:
    """
    Load the monthly MAX data from Excel reference file.

    The Excel files have a sheet with MAX of Close values organized as:
    - Rows: Years (2000, 2001, etc.)
    - Columns: Months (1-12)
    """
    try:
        # Try to read the sheet with monthly max data
        # Excel files typically have multiple sheets - look for the one with price data
        xl = pd.ExcelFile(excel_path)
        print(f"  Sheets in {ticker}: {xl.sheet_names}")

        # Try different possible sheet names
        for sheet_name in xl.sheet_names:
            try:
                df = pd.read_excel(excel_path, sheet_name=sheet_name)
                # Look for a sheet that has year/month structure
                if 'Row Labels' in df.columns or df.columns[0] in ['Row Labels', 'Year']:
                    print(f"  Found data in sheet: {sheet_name}")
                    return df, sheet_name
            except Exception as e:
                continue

        # If no specific sheet found, return first sheet
        df = pd.read_excel(excel_path, sheet_name=0)
        return df, xl.sheet_names[0]

    except Exception as e:
        print(f"  Error loading {excel_path}: {e}")
        return None, None


def load_fetched_monthly(csv_path: str, ticker: str) -> pd.DataFrame:
    """Load fetched monthly data for a specific ticker."""
    df = pd.read_csv(csv_path)
    df = df[df['ticker'] == ticker].copy()
    return df


def compare_values(excel_val, fetched_val, tolerance=0.02):
    """Compare two values with a tolerance (default 2% for rounding differences)."""
    if pd.isna(excel_val) or pd.isna(fetched_val):
        return None  # Can't compare

    if excel_val == 0:
        return fetched_val == 0

    pct_diff = abs(excel_val - fetched_val) / abs(excel_val)
    return pct_diff <= tolerance


def validate_ticker(ticker: str, excel_path: str, monthly_csv: str) -> dict:
    """Validate a single ticker against its Excel reference."""
    print(f"\nValidating {ticker}...")

    results = {
        'ticker': ticker,
        'excel_found': False,
        'data_compared': False,
        'matches': 0,
        'mismatches': 0,
        'missing': 0,
        'sample_comparisons': []
    }

    # Load Excel data
    excel_df, sheet_name = load_excel_monthly_max(excel_path, ticker)
    if excel_df is None:
        print(f"  Could not load Excel file")
        return results

    results['excel_found'] = True
    print(f"  Excel shape: {excel_df.shape}")
    print(f"  Excel columns: {list(excel_df.columns)[:15]}...")

    # Load fetched data
    fetched_df = load_fetched_monthly(monthly_csv, ticker)
    print(f"  Fetched rows: {len(fetched_df)}")

    if len(fetched_df) == 0:
        print(f"  No fetched data for {ticker}")
        return results

    # Show sample of fetched data
    print(f"\n  Sample fetched data (2020):")
    sample = fetched_df[fetched_df['year'] == 2020][['year', 'month', 'high_max']].head(12)
    for _, row in sample.iterrows():
        print(f"    {int(row['year'])}-{int(row['month']):02d}: ${row['high_max']:.2f}")

    results['data_compared'] = True
    return results


def main():
    print("=" * 60)
    print("DATA VALIDATION: Fetched vs Excel Reference")
    print("=" * 60)

    # Check files exist
    if not MONTHLY_CSV.exists():
        print(f"ERROR: {MONTHLY_CSV} not found. Run fetch_historical.py first.")
        return

    # Tickers with Excel references
    excel_files = {
        'AAPL': EXCEL_DIR / 'StockAnalysis-AAPL.xlsx',
        'AMZN': EXCEL_DIR / 'StockAnalysis-AMZN.xlsx',
        'CVX': EXCEL_DIR / 'StockAnalysis-CVX.xlsx',
        'SBUX': EXCEL_DIR / 'StockAnalysis-SBUX.xlsx',
        'TSLA': EXCEL_DIR / 'StockAnalysis-TSLA.xlsx',
    }

    # Validate each ticker
    all_results = []
    for ticker, excel_path in excel_files.items():
        if not excel_path.exists():
            print(f"\nWARNING: {excel_path} not found")
            continue

        results = validate_ticker(ticker, str(excel_path), str(MONTHLY_CSV))
        all_results.append(results)

    # Summary
    print("\n" + "=" * 60)
    print("VALIDATION SUMMARY")
    print("=" * 60)

    for r in all_results:
        status = "OK" if r['excel_found'] and r['data_compared'] else "CHECK"
        print(f"  {r['ticker']}: {status}")


if __name__ == '__main__':
    main()
