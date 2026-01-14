#!/usr/bin/env python3
"""
Full validation of fetched data against Excel reference files.
"""

import pandas as pd
from pathlib import Path

EXCEL_DIR = Path("../imports/excel_heatmaps")
MONTHLY_CSV = Path("tier1_monthly_validated.csv")

def load_excel_max_close(excel_path: str) -> pd.DataFrame:
    """Load MAX of Close data from Excel, structured as year x month."""
    df = pd.read_excel(excel_path, sheet_name=0, header=None)

    # Find the data start row (where years begin)
    data_rows = []
    for idx, row in df.iterrows():
        first_val = row[0]
        if isinstance(first_val, (int, float)) and 1980 <= first_val <= 2030:
            # This is a year row
            year = int(first_val)
            months = row[1:13].values  # Columns 1-12 are months
            for month, value in enumerate(months, 1):
                if pd.notna(value):
                    data_rows.append({
                        'year': year,
                        'month': month,
                        'close_max_excel': float(value)
                    })

    return pd.DataFrame(data_rows)


def validate_ticker(ticker: str, excel_path: str, monthly_df: pd.DataFrame) -> dict:
    """Validate a single ticker."""
    print(f"\n{'='*60}")
    print(f"VALIDATING: {ticker}")
    print('='*60)

    # Load Excel data
    excel_df = load_excel_max_close(excel_path)
    print(f"Excel: {len(excel_df)} monthly records")

    # Filter our data for this ticker
    our_df = monthly_df[monthly_df['ticker'] == ticker].copy()
    print(f"Fetched: {len(our_df)} monthly records")

    # Merge for comparison
    merged = pd.merge(
        our_df[['year', 'month', 'close_max']],
        excel_df,
        on=['year', 'month'],
        how='inner'
    )
    print(f"Matched: {len(merged)} records for comparison")

    if len(merged) == 0:
        print("  No matching records to compare!")
        return {'ticker': ticker, 'status': 'NO_MATCH', 'matches': 0, 'total': 0}

    # Calculate differences
    merged['diff'] = abs(merged['close_max'] - merged['close_max_excel'])
    merged['pct_diff'] = merged['diff'] / merged['close_max_excel'] * 100

    # Count matches (within 0.1% tolerance for floating point)
    matches = (merged['pct_diff'] < 0.1).sum()
    total = len(merged)
    match_pct = matches / total * 100

    print(f"\nResults: {matches}/{total} ({match_pct:.1f}%) within 0.1% tolerance")

    # Show any mismatches
    mismatches = merged[merged['pct_diff'] >= 0.1]
    if len(mismatches) > 0:
        print(f"\nMismatches ({len(mismatches)}):")
        for _, row in mismatches.head(5).iterrows():
            print(f"  {int(row['year'])}-{int(row['month']):02d}: "
                  f"Ours={row['close_max']:.2f}, Excel={row['close_max_excel']:.2f}, "
                  f"Diff={row['pct_diff']:.2f}%")
    else:
        print("\nAll values match!")

    # Show sample of matching data
    print(f"\nSample comparisons (2020):")
    sample = merged[merged['year'] == 2020].head(6)
    for _, row in sample.iterrows():
        status = "OK" if row['pct_diff'] < 0.1 else "MISMATCH"
        print(f"  {int(row['year'])}-{int(row['month']):02d}: "
              f"Ours=${row['close_max']:.2f}, Excel=${row['close_max_excel']:.2f} [{status}]")

    return {
        'ticker': ticker,
        'status': 'PASS' if match_pct >= 99 else 'FAIL',
        'matches': matches,
        'total': total,
        'match_pct': match_pct
    }


def main():
    print("="*60)
    print("DATA VALIDATION: Fetched vs Excel Reference Files")
    print("="*60)

    # Load our monthly data
    monthly_df = pd.read_csv(MONTHLY_CSV)
    print(f"\nLoaded {len(monthly_df)} total monthly records from fetched data")

    # Excel files to validate
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
            print(f"\nWARNING: {excel_path} not found")
            continue
        result = validate_ticker(ticker, str(excel_path), monthly_df)
        results.append(result)

    # Summary
    print("\n" + "="*60)
    print("VALIDATION SUMMARY")
    print("="*60)
    print(f"{'Ticker':<8} {'Status':<10} {'Matches':<15} {'%':<8}")
    print("-"*45)

    all_pass = True
    for r in results:
        print(f"{r['ticker']:<8} {r['status']:<10} {r['matches']}/{r['total']:<10} {r.get('match_pct', 0):.1f}%")
        if r['status'] != 'PASS':
            all_pass = False

    print("-"*45)
    print(f"\nOVERALL: {'PASS - Data validated!' if all_pass else 'FAIL - Check mismatches'}")


if __name__ == '__main__':
    main()
