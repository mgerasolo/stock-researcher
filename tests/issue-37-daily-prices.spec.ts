import { test, expect } from '@playwright/test';

/**
 * Issue #37: Store daily close prices in database
 *
 * Provides accurate current price and 52W high/low data
 * for the Stock Health Indicator (#36).
 */

test.describe('Daily Prices & Health API', () => {

  test.describe('GET /api/stocks/:ticker/health', () => {

    test('returns health data for valid ticker', async ({ request }) => {
      const response = await request.get('/api/stocks/AAPL/health');

      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);

      const data = await response.json();

      // Verify required fields exist
      expect(data).toHaveProperty('ticker', 'AAPL');
      expect(data).toHaveProperty('current');
      expect(data).toHaveProperty('high52w');
      expect(data).toHaveProperty('low52w');
      expect(data).toHaveProperty('pctFromHigh');
      expect(data).toHaveProperty('pctFromLow');
      expect(data).toHaveProperty('riskTier');
      expect(data).toHaveProperty('dataDate');
    });

    test('returns correct data types', async ({ request }) => {
      const response = await request.get('/api/stocks/SPY/health');
      const data = await response.json();

      expect(typeof data.ticker).toBe('string');
      expect(typeof data.current).toBe('number');
      expect(typeof data.high52w).toBe('number');
      expect(typeof data.low52w).toBe('number');
      expect(typeof data.pctFromHigh).toBe('number');
      expect(typeof data.pctFromLow).toBe('number');
      expect(typeof data.riskTier).toBe('string');
      expect(typeof data.dataDate).toBe('string');
    });

    test('pctFromHigh is negative or zero', async ({ request }) => {
      const response = await request.get('/api/stocks/AAPL/health');
      const data = await response.json();

      // pctFromHigh should be <= 0 (you can't be above the high)
      expect(data.pctFromHigh).toBeLessThanOrEqual(0);
    });

    test('pctFromLow is positive or zero', async ({ request }) => {
      const response = await request.get('/api/stocks/AAPL/health');
      const data = await response.json();

      // pctFromLow should be >= 0 (you can't be below the low)
      expect(data.pctFromLow).toBeGreaterThanOrEqual(0);
    });

    test('riskTier is valid enum value', async ({ request }) => {
      const response = await request.get('/api/stocks/MSFT/health');
      const data = await response.json();

      expect(['healthy', 'caution', 'high']).toContain(data.riskTier);
    });

    test('riskTier matches pctFromHigh thresholds', async ({ request }) => {
      const response = await request.get('/api/stocks/SPY/health');
      const data = await response.json();

      const pctDown = Math.abs(data.pctFromHigh);

      if (pctDown <= 10) {
        expect(data.riskTier).toBe('healthy');
      } else if (pctDown <= 30) {
        expect(data.riskTier).toBe('caution');
      } else {
        expect(data.riskTier).toBe('high');
      }
    });

    test('high52w >= low52w', async ({ request }) => {
      const response = await request.get('/api/stocks/NVDA/health');
      const data = await response.json();

      expect(data.high52w).toBeGreaterThanOrEqual(data.low52w);
    });

    test('current price is between low52w and high52w (usually)', async ({ request }) => {
      const response = await request.get('/api/stocks/GOOGL/health');
      const data = await response.json();

      // Current should typically be within 52W range
      // Allow some tolerance for edge cases (new highs/lows)
      expect(data.current).toBeGreaterThanOrEqual(data.low52w * 0.95);
      expect(data.current).toBeLessThanOrEqual(data.high52w * 1.05);
    });

    test('returns 404 for unknown ticker', async ({ request }) => {
      const response = await request.get('/api/stocks/NOTAREALTICKER/health');

      expect(response.status()).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    test('returns 400 for invalid ticker format', async ({ request }) => {
      const response = await request.get('/api/stocks/!!INVALID!!/health');

      expect(response.status()).toBe(400);
    });

    test('dataDate is recent (within 7 days)', async ({ request }) => {
      const response = await request.get('/api/stocks/AAPL/health');
      const data = await response.json();

      const dataDate = new Date(data.dataDate);
      const now = new Date();
      const diffDays = (now.getTime() - dataDate.getTime()) / (1000 * 60 * 60 * 24);

      // Data should be reasonably fresh (within a week, accounting for weekends/holidays)
      expect(diffDays).toBeLessThanOrEqual(7);
    });
  });

  test.describe('Data Integrity', () => {

    test('all tracked tickers have health data', async ({ request }) => {
      // Get list of tracked tickers from monthly prices
      const stocksResponse = await request.get('/api/stocks');
      const stocks = await stocksResponse.json();

      // Spot check a few tickers
      const tickersToCheck = stocks.slice(0, 5).map((s: any) => s.ticker || s);

      for (const ticker of tickersToCheck) {
        const healthResponse = await request.get(`/api/stocks/${ticker}/health`);
        expect(healthResponse.ok()).toBeTruthy();
      }
    });

    test('multiple tickers return different data', async ({ request }) => {
      const [appleRes, msftRes] = await Promise.all([
        request.get('/api/stocks/AAPL/health'),
        request.get('/api/stocks/MSFT/health')
      ]);

      const apple = await appleRes.json();
      const msft = await msftRes.json();

      // Prices should differ (different stocks)
      expect(apple.current).not.toBe(msft.current);
      expect(apple.ticker).toBe('AAPL');
      expect(msft.ticker).toBe('MSFT');
    });
  });

  test.describe('Performance', () => {

    test('health endpoint responds within 500ms', async ({ request }) => {
      const start = Date.now();
      await request.get('/api/stocks/AAPL/health');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
    });

    test('batch health requests complete reasonably', async ({ request }) => {
      const tickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA'];

      const start = Date.now();
      await Promise.all(
        tickers.map(t => request.get(`/api/stocks/${t}/health`))
      );
      const duration = Date.now() - start;

      // 5 parallel requests should complete within 2 seconds
      expect(duration).toBeLessThan(2000);
    });
  });
});
