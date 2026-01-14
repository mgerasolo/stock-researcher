#!/usr/bin/env python3
"""
Correct validation - only read the first MAX of Close section.
"""

import pandas as pd
from pathlib import Path

EXCEL_DIR = Path("../imports/excel_heatmaps")
MONTHLY_CSV = Path("tier1_monthly_validated.csv")

def load_excel_max_close(excel_path: str) -> pd.DataFrame:
    """
    Load ONLY the 'MAX of Close Last for the Month' section from Excel.

    Structure:
    - Row 1: Section title
    - Row 2: Subtitle
    - Row 3: Headers (Row Labels, 1, 2, ..., 12, Grand Total, AVG, MIN, MAX, YoY)
    - Row 4+: Year data (2000, 2001, etc.)
    - Ends at 'Grand Total' row
    """
    df = pd.read_excel(excel_path, sheet_name=0, header=None)

    data_rows = []
    in_data_section = False

    for idx, row in df.iterrows():
        first_val = row[0]

        # Skip until we find year rows (after header)
        if isinstance(first_val, (int, float)) and 1980 <= first_val <= 2030:
            in_data_section = True
            year = int(first_val)
            # Columns 1-12 are months
            for month in range(1, 13):
                value = row[month]
                if pd.notna(value) and isinstance(value, (int, float)):
                    data_rows.append({
                        'year': year,
                        'month': month,
                        'close_max_excel': float(value)
                    })

        # Stop at Grand Total (end of first section)
        elif in_data_section and str(first_val).strip() == 'Grand Total':
            break

    return pd.DataFrame(data_rows)


def validate_ticker(ticker: str, excel_path: str, monthly_df: pd.DataFrame) -> dict:
    """Validate a single ticker."""
    print(f"\n{'='*60}")
    print(f"VALIDATING: {ticker}")
    print('='*60)

    # Load Excel data (first section only)
    excel_df = load_excel_max_close(excel_path)
    print(f"Excel MAX of Close: {len(excel_df)} monthly records")
    print(f"  Years: {excel_df['year'].min()} - {excel_df['year'].max()}")

    # Filter our data for this ticker
    our_df = monthly_df[monthly_df['ticker'] == ticker].copy()
    print(f"Fetched: {len(our_df)} monthly records")
    print(f"  Years: {our_df['year'].min()} - {our_df['year'].max()}")

    # Merge for comparison
    merged = pd.merge(
        our_df[['year', 'month', 'close_max']],
        excel_df,
        on=['year', 'month'],
        how='inner'
    )
    print(f"Overlapping: {len(merged)} records")

    if len(merged) == 0:
        return {'ticker': ticker, 'status': 'NO_OVERLAP', 'matches': 0, 'total': 0}

    # Calculate differences
    merged['diff'] = abs(merged['close_max'] - merged['close_max_excel'])
    merged['pct_diff'] = merged['diff'] / merged['close_max_excel'] * 100

    # Count matches (within 1% tolerance for minor data source differences)
    matches = (merged['pct_diff'] < 1.0).sum()
    total = len(merged)
    match_pct = matches / total * 100

    print(f"\nResults: {matches}/{total} ({match_pct:.1f}%) within 1% tolerance")

    # Show any significant mismatches
    mismatches = merged[merged['pct_diff'] >= 1.0]
    if len(mismatches) > 0:
        print(f"\nSignificant mismatches (>1%):")
        for _, row in mismatches.head(10).iterrows():
            print(f"  {int(row['year'])}-{int(row['month']):02d}: "
                  f"Ours=${row['close_max']:.2f}, Excel=${row['close_max_excel']:.2f}, "
                  f"Diff={row['pct_diff']:.2f}%")
    else:
        print("\nAll values within 1% tolerance!")

    # Show sample comparisons
    print(f"\nSample comparisons (most recent years):")
    sample = merged.sort_values(['year', 'month'], ascending=False).head(12)
    for _, row in sample.iterrows():
        status = "OK" if row['pct_diff'] < 1.0 else "DIFF"
        print(f"  {int(row['year'])}-{int(row['month']):02d}: "
              f"Ours=${row['close_max']:>8.2f}, Excel=${row['close_max_excel']:>8.2f} [{status}]")

    return {
        'ticker': ticker,
        'status': 'PASS' if match_pct >= 95 else 'CHECK',
        'matches': matches,
        'total': total,
        'match_pct': match_pct
    }


def main():
    print("="*60)
    print("DATA VALIDATION: Fetched vs Excel (First Section Only)")
    print("="*60)

    monthly_df = pd.read_csv(MONTHLY_CSV)
    print(f"\nLoaded {len(monthly_df)} monthly records from fetched data")

    excel_files = {
        'AAPL': EXCEL_DIR / 'StockAnalysis-AAPL.xlsx',
        'AMZN': EXCEL_DIR / 'StockAnalysis-AMZN.xlsx',
        'CVX': EXCEL_DIR / 'StockAnalysis-CVX.xlsx',
        'SBUX': EXCEL_DIR / 'StockAnalysis-SBUX.xlsx',
        'TSLA': EXCEL_DIR / 'StockAnalysis-TSLA.xlsx',
    }

    results = []
    for ticker, excel_path in excel_files.items():
        if not excel_path.exists():
            continue
        result = validate_ticker(ticker, str(excel_path), monthly_df)
        results.append(result)

    # Summary
    print("\n" + "="*60)
    print("VALIDATION SUMMARY")
    print("="*60)
    print(f"{'Ticker':<8} {'Status':<10} {'Matches':<15} {'%':<8}")
    print("-"*45)

    for r in results:
        print(f"{r['ticker']:<8} {r['status']:<10} {r['matches']}/{r['total']:<10} {r.get('match_pct', 0):.1f}%")

    print("-"*45)
    all_pass = all(r['status'] == 'PASS' for r in results)
    print(f"\nOVERALL: {'ALL VALIDATED!' if all_pass else 'Review results above'}")


if __name__ == '__main__':
    main()
