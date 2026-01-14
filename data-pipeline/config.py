"""
Stock Research Data Pipeline Configuration
"""
import os
from dotenv import load_dotenv

load_dotenv()

# Tier 1 stocks - Initial priority list with Excel references for validation
TIER_1_STOCKS = [
    "AAPL",   # Apple - has Excel reference
    "TSLA",   # Tesla - has Excel reference
    "AMZN",   # Amazon - has Excel reference
    "MSFT",   # Microsoft
    "GOOGL",  # Alphabet
    "NVDA",   # Nvidia
    "RCL",    # Royal Caribbean
    "ASML",   # ASML Holding
    "AMD",    # AMD
    "WMT",    # Walmart
    "SBUX",   # Starbucks - has Excel reference
    "NFLX",   # Netflix
    "COIN",   # Coinbase (IPO 2021 - limited history)
    "DAKT",   # Daktronics
    "KEN",    # Kenon Holdings (spun off 2015 - limited history)
    "CVX",    # Chevron - has Excel reference
]

# Tier 2 stocks - From portfolio, import after Tier 1 validated
# Note: ALTR removed (acquired by Siemens Jan 2025)
# Note: PARA → PSKY (merged with Skydance Aug 2025)
# Note: SQ → XYZ (Block ticker change Jan 2025)
TIER_2_STOCKS = [
    "AFRM", "ARKK", "AXON", "BILL", "BROS", "CELH", "CHPT", "CHWY",
    "CRSP", "CRWD", "CVNA", "DDOG", "DELL", "DIS", "DUOL", "ENPH", "F", "FCX",
    "FLEX", "FSLR", "FTNT", "GILD", "GM", "GRAB", "GRMN", "GTLB", "HLT", "HOOD",
    "HPQ", "HUBS", "IONQ", "JBLU", "JD", "KLAC", "LEN", "LRCX", "LUV", "LYFT",
    "META", "MU", "NET", "NIO", "NOW", "OKTA", "ON", "PANW", "PAYC",
    "PINS", "PLTR", "PSKY", "PYPL", "QCOM", "RIVN", "ROKU", "SE", "SHOP", "SNAP", "SNOW",
    "SOFI", "TEVA", "TGT", "TOST", "TTD", "TWLO", "U", "UBER", "UPST",
    "VRT", "WDAY", "WFC", "XYZ", "ZM", "ZS",
]

# Data fetching configuration
START_DATE = "2000-01-01"  # Fetch data from 2000 onwards
END_DATE = None  # None = fetch up to today

# Database configuration
# IMPORTANT: Defaults to Banner (10.0.0.33:3380), NOT localhost
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:localdev@10.0.0.33:3380/stock_researcher"
)

# Rate limiting (be a good citizen even though yfinance doesn't require it)
DELAY_BETWEEN_FETCHES = 1.0  # seconds between API calls
