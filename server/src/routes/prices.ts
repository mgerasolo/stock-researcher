import { Router } from 'express';
import { query } from '../db.js';

export const pricesRouter = Router();

interface MonthlyPrice {
  id: number;
  ticker: string;
  year: number;
  month: number;
  close_max: number | null;
  open_first: number | null;
  close_last: number | null;
  high_max: number | null;
  low_min: number | null;
  created_at: Date;
}

interface HeatmapCell {
  year: number;
  month: number;
  close_max: number;
  return_pct: number | null;
  entry_date: string | null;
  exit_date: string | null;
  entry_price: number | null;
  exit_price: number | null;
}

type CalculationMethod = 'openClose' | 'maxMax';

// GET /api/prices/:ticker/monthly - Get monthly prices for heatmap
pricesRouter.get('/:ticker/monthly', async (req, res) => {
  const { ticker } = req.params;
  const years = parseInt(req.query.years as string) || 10;

  try {
    const prices = await query<MonthlyPrice>(
      `
      SELECT *
      FROM monthly_prices
      WHERE ticker = $1
        AND year >= EXTRACT(YEAR FROM CURRENT_DATE) - $2
      ORDER BY year DESC, month
    `,
      [ticker.toUpperCase(), years]
    );

    if (prices.length === 0) {
      return res.status(404).json({ error: 'No price data found for ticker' });
    }

    res.json(prices);
  } catch (error) {
    console.error('Error fetching monthly prices:', error);
    res.status(500).json({ error: 'Failed to fetch prices' });
  }
});

// GET /api/prices/:ticker/heatmap - Get calculated heatmap data with returns
pricesRouter.get('/:ticker/heatmap', async (req, res) => {
  const { ticker } = req.params;
  const holdingPeriod = parseInt(req.query.period as string) || 3; // Default 3 months
  const years = parseInt(req.query.years as string) || 10;
  const viewMode = (req.query.view as string) || 'exit'; // 'exit' or 'entry'
  const calcMethod = (req.query.calcMethod as CalculationMethod) || 'openClose'; // 'openClose' or 'maxMax'

  try {
    // Get all monthly prices for the ticker
    const prices = await query<MonthlyPrice>(
      `
      SELECT *
      FROM monthly_prices
      WHERE ticker = $1
        AND year >= EXTRACT(YEAR FROM CURRENT_DATE) - $2 - 1
      ORDER BY year, month
    `,
      [ticker.toUpperCase(), years]
    );

    if (prices.length === 0) {
      return res.status(404).json({ error: 'No price data found for ticker' });
    }

    // Calculate rolling returns
    const heatmapData = calculateHeatmap(prices, holdingPeriod, viewMode, calcMethod);

    // Calculate benchmark returns for alpha calculation
    const benchmarkReturns = await calculateBenchmarkReturns(holdingPeriod, years, calcMethod);

    // Calculate aggregates per month (with alpha vs benchmarks)
    const aggregates = calculateAggregates(heatmapData, benchmarkReturns, holdingPeriod, calcMethod);

    res.json({
      ticker: ticker.toUpperCase(),
      holdingPeriod,
      viewMode,
      calcMethod,
      years,
      data: heatmapData,
      aggregates,
      lastUpdated: prices[prices.length - 1]?.created_at,
    });
  } catch (error) {
    console.error('Error calculating heatmap:', error);
    res.status(500).json({ error: 'Failed to calculate heatmap' });
  }
});

function calculateHeatmap(
  prices: MonthlyPrice[],
  holdingPeriod: number,
  viewMode: string,
  calcMethod: CalculationMethod
): HeatmapCell[] {
  const results: HeatmapCell[] = [];

  // Create a map for quick lookup
  const priceMap = new Map<string, MonthlyPrice>();
  for (const p of prices) {
    priceMap.set(`${p.year}-${p.month}`, p);
  }

  for (const price of prices) {
    // Calculate target month based on holding period
    let targetYear = price.year;
    let targetMonth = price.month + holdingPeriod;

    while (targetMonth > 12) {
      targetMonth -= 12;
      targetYear++;
    }

    const targetPrice = priceMap.get(`${targetYear}-${targetMonth}`);

    if (targetPrice) {
      let entryPrice: number | null;
      let exitPrice: number | null;

      if (calcMethod === 'maxMax') {
        // Max-to-Max: Use close_max for both entry and exit
        // This measures peak-to-peak performance within each month
        entryPrice = price.close_max;
        exitPrice = targetPrice.close_max;
      } else {
        // Open-to-Close (default): Buy at month's open, sell at exit month's close
        // This represents a more realistic tradeable scenario
        // Fallback to close_max if the new columns aren't populated yet
        entryPrice = price.open_first || price.close_max;
        exitPrice = targetPrice.close_last || targetPrice.close_max;
      }

      // Skip if we don't have valid prices
      if (entryPrice == null || exitPrice == null || entryPrice === 0) {
        continue;
      }

      const returnPct = ((exitPrice - entryPrice) / entryPrice) * 100;

      // viewMode determines which month to show
      // 'exit' = show in the exit month column (traditional)
      // 'entry' = show in the entry month column (when to buy)
      const displayYear = viewMode === 'entry' ? price.year : targetYear;
      const displayMonth = viewMode === 'entry' ? price.month : targetMonth;

      // Use entry/exit price for close_max display (already validated as non-null)
      const displayCloseMax = viewMode === 'entry' ? entryPrice : exitPrice;

      results.push({
        year: displayYear,
        month: displayMonth,
        close_max: displayCloseMax,
        return_pct: Math.round(returnPct * 100) / 100,
        entry_date: `${price.year}-${String(price.month).padStart(2, '0')}-01`,
        exit_date: `${targetYear}-${String(targetMonth).padStart(2, '0')}-28`,
        entry_price: Math.round(entryPrice * 100) / 100,
        exit_price: Math.round(exitPrice * 100) / 100,
      });
    }
  }

  return results;
}

interface MonthAggregate {
  month: number;
  win_rate: number;
  avg_return: number;
  min_return: number;
  max_return: number;
  count: number;
  alpha: number; // Return vs market (SPY+DIA average)
  market_return: number; // Benchmark return for this period
}

interface BenchmarkReturn {
  month: number;
  avgReturn: number;
}

function calculateAggregates(
  data: HeatmapCell[],
  benchmarkReturns: BenchmarkReturn[],
  holdingPeriod: number,
  calcMethod: CalculationMethod
): MonthAggregate[] {
  const monthGroups = new Map<number, number[]>();

  for (const cell of data) {
    if (cell.return_pct !== null) {
      if (!monthGroups.has(cell.month)) {
        monthGroups.set(cell.month, []);
      }
      monthGroups.get(cell.month)!.push(cell.return_pct);
    }
  }

  // Create a map of benchmark returns by month
  const benchmarkMap = new Map<number, number>();
  for (const b of benchmarkReturns) {
    benchmarkMap.set(b.month, b.avgReturn);
  }

  // For open-to-close, actual holding is period + 1 months
  const actualHoldingMonths = calcMethod === 'openClose' ? holdingPeriod + 1 : holdingPeriod;

  const aggregates: MonthAggregate[] = [];

  for (let month = 1; month <= 12; month++) {
    const returns = monthGroups.get(month) || [];
    if (returns.length > 0) {
      const wins = returns.filter((r) => r > 0).length;
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const marketReturn = benchmarkMap.get(month) || 0;

      // Calculate alpha as avg per month vs market per month
      const avgPerMonth = avgReturn / actualHoldingMonths;
      const marketPerMonth = marketReturn / actualHoldingMonths;
      const alpha = avgPerMonth - marketPerMonth;

      aggregates.push({
        month,
        win_rate: Math.round((wins / returns.length) * 100),
        avg_return: Math.round(avgReturn * 100) / 100,
        min_return: Math.round(Math.min(...returns) * 100) / 100,
        max_return: Math.round(Math.max(...returns) * 100) / 100,
        count: returns.length,
        alpha: Math.round(alpha * 100) / 100,
        market_return: Math.round(marketReturn * 100) / 100,
      });
    }
  }

  return aggregates;
}

const BENCHMARKS = ['SPY', 'DIA'];

async function calculateBenchmarkReturns(
  holdingPeriod: number,
  years: number,
  calcMethod: CalculationMethod
): Promise<BenchmarkReturn[]> {
  // Fetch benchmark prices
  const benchmarkPrices = await query<MonthlyPrice>(
    `
    SELECT *
    FROM monthly_prices
    WHERE ticker = ANY($1)
      AND year >= EXTRACT(YEAR FROM CURRENT_DATE) - $2 - 1
    ORDER BY ticker, year, month
    `,
    [BENCHMARKS, years]
  );

  // Group prices by ticker
  const pricesByTicker = new Map<string, MonthlyPrice[]>();
  for (const price of benchmarkPrices) {
    if (!pricesByTicker.has(price.ticker)) {
      pricesByTicker.set(price.ticker, []);
    }
    pricesByTicker.get(price.ticker)!.push(price);
  }

  // Calculate returns for each benchmark
  const allBenchmarkReturns: Map<number, number[]> = new Map();

  for (const [, prices] of pricesByTicker) {
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
      const entryMonth = price.month;

      if (!allBenchmarkReturns.has(entryMonth)) {
        allBenchmarkReturns.set(entryMonth, []);
      }
      allBenchmarkReturns.get(entryMonth)!.push(returnPct);
    }
  }

  // Average returns across benchmarks for each month
  const benchmarkReturns: BenchmarkReturn[] = [];
  for (let month = 1; month <= 12; month++) {
    const returns = allBenchmarkReturns.get(month) || [];
    if (returns.length > 0) {
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      benchmarkReturns.push({
        month,
        avgReturn: Math.round(avgReturn * 100) / 100,
      });
    }
  }

  return benchmarkReturns;
}
