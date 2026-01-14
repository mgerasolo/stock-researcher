#!/usr/bin/env python3
"""
Inspect Excel file structure to understand data layout.
"""

import pandas as pd
from pathlib import Path

EXCEL_PATH = Path("../imports/excel_heatmaps/StockAnalysis-AMZN.xlsx")

def inspect_excel():
    xl = pd.ExcelFile(EXCEL_PATH)
    print(f"Sheets: {xl.sheet_names}")

    for sheet in xl.sheet_names:
        print(f"\n{'='*60}")
        print(f"SHEET: {sheet}")
        print('='*60)

        df = pd.read_excel(EXCEL_PATH, sheet_name=sheet, header=None)
        print(f"Shape: {df.shape}")

        # Print first 30 rows to see structure
        print("\nFirst 30 rows:")
        pd.set_option('display.max_columns', 20)
        pd.set_option('display.width', 200)
        print(df.head(30).to_string())

        # Look for "MAX of Close" or similar text
        for idx, row in df.iterrows():
            row_str = ' '.join([str(v) for v in row.values if pd.notna(v)])
            if 'MAX' in row_str.upper() or 'Close' in row_str:
                print(f"\nFound relevant row at index {idx}:")
                print(row.to_string())

        if sheet == 'Analysis':
            break  # Just inspect first sheet for now

if __name__ == '__main__':
    inspect_excel()
