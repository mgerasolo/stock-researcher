"""
S&P 500 Stock List - Most Actively Traded US Stocks

This list contains the 503 stocks in the S&P 500 index as of January 2025.
Note: The S&P 500 contains 500 companies but 503 stock tickers because
three companies (Alphabet, Fox Corp, News Corp) have dual share classes.

Source: https://www.slickcharts.com/sp500
Updated: 2025-01-14

Combined market cap: ~$63 trillion
Coverage: ~80% of US equity market capitalization
Exchanges: NYSE, NASDAQ
"""

# S&P 500 Stocks - All 503 tickers sorted alphabetically
SP500_STOCKS = [
    # A
    "A", "AAPL", "ABBV", "ABNB", "ABT", "ACGL", "ACN", "ADBE", "ADI", "ADM",
    "ADP", "ADSK", "AEE", "AEP", "AES", "AFL", "AIG", "AIZ", "AJG", "AKAM",
    "ALB", "ALGN", "ALL", "ALLE", "AMAT", "AMCR", "AMD", "AME", "AMGN", "AMP",
    "AMT", "AMZN", "ANET", "AON", "AOS", "APA", "APD", "APH", "APO", "APP",
    "APTV", "ARE", "ARES", "AVGO", "AVB", "AVY", "AWK", "AXON", "AXP", "AZO",
    # B
    "BA", "BAC", "BALL", "BAX", "BBY", "BDX", "BEN", "BF.B", "BG", "BIIB",
    "BK", "BKNG", "BLK", "BLDR", "BMY", "BR", "BRK.B", "BRO", "BSX", "BX",
    "BXP",
    # C
    "C", "CAG", "CAH", "CARR", "CAT", "CB", "CBOE", "CBRE", "CCI", "CCL",
    "CDNS", "CDW", "CE", "CEG", "CF", "CFG", "CHD", "CHRW", "CHTR", "CI",
    "CINF", "CL", "CLX", "CMA", "CMCSA", "CME", "CMG", "CMI", "CMS", "CNC",
    "CNP", "COF", "COIN", "COO", "COP", "COR", "COST", "CPAY", "CPB", "CPRT",
    "CPT", "CRL", "CRM", "CRWD", "CSCO", "CSGP", "CSX", "CTAS", "CTSH", "CTRA",
    "CTVA", "CVNA", "CVS", "CVX",
    # D
    "D", "DAL", "DASH", "DAY", "DD", "DDOG", "DE", "DECK", "DELL", "DFS",
    "DG", "DGX", "DHI", "DHR", "DIS", "DLR", "DLTR", "DOC", "DOV", "DOW",
    "DPZ", "DRI", "DTE", "DUK", "DVA", "DVN", "DXCM",
    # E
    "EA", "EBAY", "ECL", "ED", "EFX", "EG", "EIX", "EL", "ELV", "EME",
    "EMR", "ENPH", "EOG", "EPAM", "EQIX", "EQR", "EQT", "ERIE", "ES", "ESS",
    "ETN", "ETR", "EVRG", "EW", "EXC", "EXE", "EXPE", "EXR",
    # F
    "F", "FANG", "FAST", "FCX", "FDS", "FDX", "FE", "FFIV", "FI", "FICO",
    "FIS", "FISV", "FITB", "FIX", "FOXA", "FOX", "FRT", "FSLR", "FTNT", "FTV",
    # G
    "GD", "GDDY", "GE", "GEHC", "GEN", "GEV", "GILD", "GIS", "GL", "GLW",
    "GM", "GNRC", "GOOG", "GOOGL", "GPC", "GPN", "GRMN", "GS", "GWW",
    # H
    "HAL", "HAS", "HBAN", "HCA", "HD", "HES", "HIG", "HII", "HLT", "HOLX",
    "HON", "HOOD", "HPE", "HPQ", "HRL", "HSIC", "HST", "HSY", "HUBB", "HUM",
    "HWM",
    # I
    "IBM", "ICE", "IDXX", "IEX", "IFF", "INCY", "INTC", "INTU", "INVH", "IP",
    "IQV", "IR", "IRM", "ISRG", "IT", "ITW", "IVZ",
    # J
    "J", "JBHT", "JBL", "JCI", "JKHY", "JNJ", "JNPR", "JPM",
    # K
    "K", "KDP", "KEY", "KEYS", "KHC", "KIM", "KKR", "KLAC", "KMB", "KMI",
    "KO", "KR",
    # L
    "L", "LDOS", "LEN", "LH", "LHX", "LII", "LIN", "LKQ", "LLY", "LMT",
    "LNT", "LOW", "LRCX", "LULU", "LUV", "LVS", "LW", "LYB", "LYV",
    # M
    "MA", "MAA", "MAR", "MAS", "MCD", "MCHP", "MCK", "MCO", "MDLZ", "MDT",
    "MET", "META", "MGM", "MHK", "MKC", "MKTX", "MLM", "MMC", "MMM", "MNST",
    "MO", "MOH", "MOS", "MPC", "MPWR", "MRK", "MRNA", "MS", "MSCI", "MSFT",
    "MSI", "MTB", "MTD", "MTCH", "MU", "NCLH",
    # N
    "NDAQ", "NDSN", "NEE", "NEM", "NFLX", "NI", "NKE", "NOC", "NOW", "NRG",
    "NSC", "NTAP", "NTRS", "NUE", "NVDA", "NVR", "NWS", "NWSA", "NXPI",
    # O
    "O", "ODFL", "OKE", "OMC", "ON", "ORCL", "ORLY", "OTIS", "OXY",
    # P
    "PANW", "PARA", "PAYC", "PAYX", "PCAR", "PCG", "PEG", "PEP", "PFE", "PFG",
    "PG", "PGR", "PH", "PHM", "PKG", "PLD", "PLTR", "PM", "PNC", "PNR",
    "PNW", "PODD", "POOL", "PPG", "PPL", "PRU", "PSA", "PSX", "PTC", "PWR",
    "PYPL",
    # Q
    "QCOM", "QRVO",
    # R
    "RCL", "REG", "REGN", "RF", "RJF", "RL", "RMD", "ROK", "ROL", "ROP",
    "ROST", "RSG", "RTX", "RVTY",
    # S
    "SBAC", "SBUX", "SCHW", "SHW", "SJM", "SLB", "SMCI", "SNA", "SNPS", "SO",
    "SOLV", "SPG", "SPGI", "SRE", "STE", "STLD", "STT", "STX", "STZ", "SW",
    "SWK", "SWKS", "SYF", "SYK", "SYY",
    # T
    "T", "TAP", "TDG", "TDY", "TECH", "TEL", "TER", "TFC", "TFX", "TGT",
    "TJX", "TKO", "TMO", "TMUS", "TPL", "TPR", "TRGP", "TRMB", "TROW", "TRV",
    "TSCO", "TSLA", "TSN", "TT", "TTD", "TTWO", "TXN", "TYL",
    # U
    "U", "UAL", "UBER", "UDR", "UHS", "ULTA", "UNH", "UNP", "UPS", "URI",
    "USB",
    # V
    "V", "VICI", "VLO", "VLTO", "VMC", "VRSK", "VRSN", "VRTX", "VST", "VTR",
    "VTRS", "VZ",
    # W
    "WAB", "WAT", "WBA", "WBD", "WDAY", "WDC", "WEC", "WELL", "WFC", "WM",
    "WMB", "WMT", "WRB", "WSM", "WST", "WTW", "WY", "WYNN",
    # X
    "XEL", "XOM", "XYL", "XYZ",
    # Y
    "YUM",
    # Z
    "ZBH", "ZBRA", "ZTS",
]

# Supplementary high-volume stocks NOT in S&P 500
# These are frequently traded stocks that may be useful to include
HIGH_VOLUME_NON_SP500 = [
    # High-volume tech/growth stocks
    "AFRM",   # Affirm Holdings
    "ARKK",   # ARK Innovation ETF
    "BILL",   # Bill.com Holdings
    "BROS",   # Dutch Bros
    "CELH",   # Celsius Holdings
    "CHPT",   # ChargePoint Holdings
    "CHWY",   # Chewy
    "CRSP",   # CRISPR Therapeutics
    "DUOL",   # Duolingo
    "GRAB",   # Grab Holdings
    "GTLB",   # GitLab
    "HUBS",   # HubSpot
    "IONQ",   # IonQ
    "JBLU",   # JetBlue Airways
    "JD",     # JD.com
    "LYFT",   # Lyft
    "NET",    # Cloudflare
    "NIO",    # NIO Inc
    "OKTA",   # Okta
    "PINS",   # Pinterest
    "RIVN",   # Rivian
    "ROKU",   # Roku
    "SE",     # Sea Limited
    "SHOP",   # Shopify
    "SNAP",   # Snap Inc
    "SNOW",   # Snowflake
    "SOFI",   # SoFi Technologies
    "TEVA",   # Teva Pharmaceutical
    "TOST",   # Toast Inc
    "TWLO",   # Twilio
    "UPST",   # Upstart Holdings
    "VRT",    # Vertiv Holdings
    "ZM",     # Zoom Video
    "ZS",     # Zscaler

    # International ADRs with high US volume
    "ASML",   # ASML Holding (Netherlands)
    "TSM",    # Taiwan Semiconductor
    "BABA",   # Alibaba Group
    "PDD",    # PDD Holdings
    "MELI",   # MercadoLibre

    # Special interest stocks
    "DAKT",   # Daktronics
    "KEN",    # Kenon Holdings
]

# Combined list: SP500 + high volume additions
ALL_MAJOR_STOCKS = SP500_STOCKS + HIGH_VOLUME_NON_SP500

# Count summary
if __name__ == "__main__":
    print(f"S&P 500 stocks: {len(SP500_STOCKS)}")
    print(f"Additional high-volume stocks: {len(HIGH_VOLUME_NON_SP500)}")
    print(f"Total stocks: {len(ALL_MAJOR_STOCKS)}")

    # Check for duplicates
    all_tickers = SP500_STOCKS + HIGH_VOLUME_NON_SP500
    unique_tickers = set(all_tickers)
    if len(all_tickers) != len(unique_tickers):
        duplicates = [t for t in all_tickers if all_tickers.count(t) > 1]
        print(f"\nWARNING: Duplicate tickers found: {set(duplicates)}")
