import { Router } from 'express';
import { query } from '../db.js';

export const screenerRouter = Router();

interface MonthlyPrice {
  ticker: string;
  year: number;
  month: number;
  close_max: number | null;
  open_first: number | null;
  close_last: number | null;
}

interface ScreenerResult {
  ticker: string;
  entryMonth: number;
  entryMonthName: string;
  holdingPeriod: number;
  avgReturn: number;
  avgPerMonth: number;
  winRate: number;
  count: number;
  minReturn: number;
  maxReturn: number;
  marketReturn: number;
  marketPerMonth: number;
  alpha: number;
}

const MONTH_NAMES = ['01-Jan', '02-Feb', '03-Mar', '04-Apr', '05-May', '06-Jun', '07-Jul', '08-Aug', '09-Sep', '10-Oct', '11-Nov', '12-Dec'];
const BENCHMARKS = ['SPY', 'DIA'];

// GET /api/screener - Get ranked patterns across all stocks
screenerRouter.get('/', async (req, res) => {
  const years = parseInt(req.query.years as string) || 10;
  const minWinRate = parseFloat(req.query.minWinRate as string) || 0;
  const minAvgPerMonth = parseFloat(req.query.minAvgPerMonth as string) || 0;
  const minYears = parseInt(req.query.minYears as string) || 0;
  const holdingPeriods = (req.query.periods as string)?.split(',').map(Number) || [3, 6];
  const calcMethod = (req.query.calcMethod as string) || 'openClose';
  const limit = parseInt(req.query.limit as string) || 100;

  try {
    // Get all tickers (excluding benchmarks)
    const stocksResult = await query<{ ticker: string }>(
      `SELECT DISTINCT ticker FROM monthly_prices WHERE ticker NOT IN ('SPY', 'DIA') ORDER BY ticker`
    );
    const tickers = stocksResult.map(s => s.ticker);

    // Get all price data
    const allPrices = await query<MonthlyPrice>(
      `
      SELECT ticker, year, month, close_max, open_first, close_last
      FROM monthly_prices
      WHERE year >= EXTRACT(YEAR FROM CURRENT_DATE) - $1 - 1
      ORDER BY ticker, year, month
      `,
      [years]
    );

    // Group prices by ticker
    const pricesByTicker = new Map<string, MonthlyPrice[]>();
    for (const p of allPrices) {
      if (!pricesByTicker.has(p.ticker)) {
        pricesByTicker.set(p.ticker, []);
      }
      pricesByTicker.get(p.ticker)!.push(p);
    }

    // Calculate benchmark returns (average of SPY and DIA)
    const benchmarkReturns = calculateBenchmarkReturns(pricesByTicker, holdingPeriods, calcMethod);

    // Calculate returns for each stock
    const results: ScreenerResult[] = [];

    for (const ticker of tickers) {
      const prices = pricesByTicker.get(ticker);
      if (!prices || prices.length === 0) continue;

      for (const period of holdingPeriods) {
        const returns = calculateReturns(prices, period, calcMethod);

        // Group by entry month
        for (let month = 1; month <= 12; month++) {
          const monthReturns = returns.filter(r => r.entryMonth === month);
          if (monthReturns.length === 0) continue;

          // Count unique years, not just data points
          const uniqueYears = new Set(monthReturns.map(r => r.entryYear)).size;

          const avgReturn = monthReturns.reduce((a, b) => a + b.returnPct, 0) / monthReturns.length;
          const wins = monthReturns.filter(r => r.returnPct > 0).length;
          const winRate = (wins / monthReturns.length) * 100;

          // For open-to-close, actual holding is period + 1 months
          const actualHoldingMonths = calcMethod === 'openClose' ? period + 1 : period;
          const avgPerMonth = avgReturn / actualHoldingMonths;

          // Get benchmark for this month/period
          const benchmarkKey = `${month}-${period}`;
          const benchmark = benchmarkReturns.get(benchmarkKey) || { avgReturn: 0, avgPerMonth: 0 };

          const alpha = avgPerMonth - benchmark.avgPerMonth;

          results.push({
            ticker,
            entryMonth: month,
            entryMonthName: MONTH_NAMES[month - 1],
            holdingPeriod: period,
            avgReturn: Math.round(avgReturn * 100) / 100,
            avgPerMonth: Math.round(avgPerMonth * 100) / 100,
            winRate: Math.round(winRate),
            count: uniqueYears,
            minReturn: Math.round(Math.min(...monthReturns.map(r => r.returnPct)) * 100) / 100,
            maxReturn: Math.round(Math.max(...monthReturns.map(r => r.returnPct)) * 100) / 100,
            marketReturn: Math.round(benchmark.avgReturn * 100) / 100,
            marketPerMonth: Math.round(benchmark.avgPerMonth * 100) / 100,
            alpha: Math.round(alpha * 100) / 100,
          });
        }
      }
    }

    // Filter by criteria
    const filtered = results.filter(r =>
      r.winRate >= minWinRate &&
      r.avgPerMonth >= minAvgPerMonth &&
      r.count >= minYears
    );

    // Sort by avgPerMonth descending
    filtered.sort((a, b) => b.avgPerMonth - a.avgPerMonth);

    // Return top results
    res.json({
      results: filtered.slice(0, limit),
      totalPatterns: filtered.length,
      totalStocks: tickers.length,
      filters: { minWinRate, minAvgPerMonth, minYears, holdingPeriods, calcMethod, years },
    });
  } catch (error) {
    console.error('Error running screener:', error);
    res.status(500).json({ error: 'Failed to run screener' });
  }
});

interface ReturnData {
  entryYear: number;
  entryMonth: number;
  returnPct: number;
}

function calculateReturns(
  prices: MonthlyPrice[],
  holdingPeriod: number,
  calcMethod: string
): ReturnData[] {
  const results: ReturnData[] = [];
  const priceMap = new Map<string, MonthlyPrice>();

  for (const p of prices) {
    priceMap.set(`${p.year}-${p.month}`, p);
  }

  for (const price of prices) {
    let targetYear = price.year;
    let targetMonth = price.month + holdingPeriod;

    while (targetMonth > 12) {
      targetMonth -= 12;
      targetYear++;
    }

    const targetPrice = priceMap.get(`${targetYear}-${targetMonth}`);
    if (!targetPrice) continue;

    let entryPrice: number | null;
    let exitPrice: number | null;

    if (calcMethod === 'maxMax') {
      entryPrice = price.close_max;
      exitPrice = targetPrice.close_max;
    } else {
      entryPrice = price.open_first || price.close_max;
      exitPrice = targetPrice.close_last || targetPrice.close_max;
    }

    if (entryPrice == null || exitPrice == null || entryPrice === 0) continue;

    const returnPct = ((exitPrice - entryPrice) / entryPrice) * 100;
    results.push({
      entryYear: price.year,
      entryMonth: price.month,
      returnPct,
    });
  }

  return results;
}

interface BenchmarkData {
  avgReturn: number;
  avgPerMonth: number;
}

function calculateBenchmarkReturns(
  pricesByTicker: Map<string, MonthlyPrice[]>,
  holdingPeriods: number[],
  calcMethod: string
): Map<string, BenchmarkData> {
  const benchmarkReturns = new Map<string, BenchmarkData>();

  // Calculate returns for each benchmark
  const benchmarkData = new Map<string, ReturnData[]>();

  for (const benchmark of BENCHMARKS) {
    const prices = pricesByTicker.get(benchmark);
    if (!prices) continue;

    for (const period of holdingPeriods) {
      const returns = calculateReturns(prices, period, calcMethod);
      const key = `${benchmark}-${period}`;
      benchmarkData.set(key, returns);
    }
  }

  // Average SPY and DIA for each month/period combination
  for (const period of holdingPeriods) {
    const actualHoldingMonths = calcMethod === 'openClose' ? period + 1 : period;

    for (let month = 1; month <= 12; month++) {
      const allReturns: number[] = [];

      for (const benchmark of BENCHMARKS) {
        const key = `${benchmark}-${period}`;
        const returns = benchmarkData.get(key) || [];
        const monthReturns = returns.filter(r => r.entryMonth === month);
        allReturns.push(...monthReturns.map(r => r.returnPct));
      }

      if (allReturns.length > 0) {
        const avgReturn = allReturns.reduce((a, b) => a + b, 0) / allReturns.length;
        benchmarkReturns.set(`${month}-${period}`, {
          avgReturn,
          avgPerMonth: avgReturn / actualHoldingMonths,
        });
      }
    }
  }

  return benchmarkReturns;
}
