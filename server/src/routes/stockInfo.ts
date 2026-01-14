import { Router } from 'express';
import YahooFinance from 'yahoo-finance2';
import { query } from '../db.js';

export const stockInfoRouter = Router();

// Create Yahoo Finance instance
const yahooFinance = new YahooFinance();

interface StockInfo {
  ticker: string;
  name: string;
  marketCap: number | null;
  marketCapFormatted: string;
  sector: string | null;
  industry: string | null;
  currentPrice: number | null;
  priceChange: number | null;
  priceChangePercent: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  description: string | null;
  exchange: string | null;
  currency: string | null;
  fetchedAt: string;
}

// Simple in-memory cache with TTL
interface CacheEntry {
  data: StockInfo;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function formatMarketCap(value: number | null | undefined): string {
  if (!value) return 'N/A';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
}

// GET /api/stock-info/:ticker - Get stock info from Yahoo Finance
stockInfoRouter.get('/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();

  try {
    // Check cache first
    const cached = cache.get(ticker);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json(cached.data);
    }

    // Fetch from Yahoo Finance - use type assertion since library types are strict
    const quote = (await yahooFinance.quote(ticker)) as Record<string, unknown>;

    if (!quote) {
      return res.status(404).json({ error: 'Stock not found' });
    }

    // Try to get additional profile info for description, sector, and industry
    let description: string | null = null;
    let sector: string | null = null;
    let industry: string | null = null;
    try {
      const quoteSummary = (await yahooFinance.quoteSummary(ticker, {
        modules: ['assetProfile'],
      })) as {
        assetProfile?: {
          longBusinessSummary?: string;
          sector?: string;
          industry?: string;
        };
      };
      description = quoteSummary.assetProfile?.longBusinessSummary || null;
      sector = quoteSummary.assetProfile?.sector || null;
      industry = quoteSummary.assetProfile?.industry || null;
    } catch {
      // Profile not available for all tickers (e.g., ETFs)
    }

    const stockInfo: StockInfo = {
      ticker,
      name: (quote.longName as string) || (quote.shortName as string) || ticker,
      marketCap: (quote.marketCap as number) || null,
      marketCapFormatted: formatMarketCap(quote.marketCap as number),
      sector,
      industry,
      currentPrice: (quote.regularMarketPrice as number) || null,
      priceChange: (quote.regularMarketChange as number) || null,
      priceChangePercent: (quote.regularMarketChangePercent as number) || null,
      fiftyTwoWeekHigh: (quote.fiftyTwoWeekHigh as number) || null,
      fiftyTwoWeekLow: (quote.fiftyTwoWeekLow as number) || null,
      description,
      exchange: (quote.exchange as string) || null,
      currency: (quote.currency as string) || null,
      fetchedAt: new Date().toISOString(),
    };

    // Store in cache
    cache.set(ticker, {
      data: stockInfo,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    res.json(stockInfo);
  } catch (error) {
    console.error('Error fetching stock info:', error);

    // Check if it's a "not found" type error
    if (error instanceof Error && error.message.includes('Not Found')) {
      return res.status(404).json({ error: 'Stock not found' });
    }

    res.status(500).json({ error: 'Failed to fetch stock info' });
  }
});

// POST /api/stock-info/batch - Get recent close prices for multiple tickers from database
// Uses database prices (fast) instead of real-time Yahoo Finance (slow)
// Purpose: Help users identify correct stock in picker, not for trading decisions
stockInfoRouter.post('/batch', async (req, res) => {
  const { tickers } = req.body as { tickers: string[] };

  if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
    return res.json({});
  }

  // Limit to 20 tickers max
  const tickerList = tickers.slice(0, 20).map((t) => t.toUpperCase());

  try {
    // Get most recent close price for each ticker from monthly_prices
    // Uses close_last (last trading day close of the month)
    const rows = await query<{
      ticker: string;
      close_last: string;
      prev_close: string | null;
    }>(
      `
      WITH latest_month AS (
        SELECT DISTINCT ON (ticker)
          ticker,
          close_last,
          year,
          month
        FROM monthly_prices
        WHERE ticker = ANY($1)
          AND close_last IS NOT NULL
        ORDER BY ticker, year DESC, month DESC
      ),
      prev_month AS (
        SELECT DISTINCT ON (mp.ticker)
          mp.ticker,
          mp.close_last as prev_close
        FROM monthly_prices mp
        JOIN latest_month lm ON mp.ticker = lm.ticker
          AND (mp.year < lm.year OR (mp.year = lm.year AND mp.month < lm.month))
        WHERE mp.close_last IS NOT NULL
        ORDER BY mp.ticker, mp.year DESC, mp.month DESC
      )
      SELECT
        lm.ticker,
        lm.close_last,
        pm.prev_close
      FROM latest_month lm
      LEFT JOIN prev_month pm ON lm.ticker = pm.ticker
      `,
      [tickerList]
    );

    // Build results object
    const results: Record<
      string,
      { price: number | null; change: number | null; changePercent: number | null }
    > = {};

    for (const row of rows) {
      const price = parseFloat(row.close_last);
      const prevClose = row.prev_close ? parseFloat(row.prev_close) : null;
      const change = prevClose ? price - prevClose : null;
      const changePercent = prevClose && prevClose !== 0 ? ((price - prevClose) / prevClose) * 100 : null;

      results[row.ticker] = {
        price,
        change,
        changePercent,
      };
    }

    res.json(results);
  } catch (error) {
    console.error('Error fetching batch prices:', error);
    res.json({});
  }
});

// Clear expired cache entries periodically
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
      if (entry.expiresAt < now) {
        cache.delete(key);
      }
    }
  },
  5 * 60 * 1000
); // Clean every 5 minutes
