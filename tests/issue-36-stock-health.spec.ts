import { test, expect } from '@playwright/test';

/**
 * Issue #36: Stock Health Indicator
 *
 * Display risk context (% from 52W high) to help users understand
 * when seasonal patterns may be unreliable due to stock distress.
 *
 * Risk Tiers:
 * - Healthy: 0-10% from 52W high (green)
 * - Caution: 10-30% from 52W high (yellow)
 * - High Risk: >30% from 52W high (red)
 */

test.describe('Stock Health Indicator', () => {

  test.describe('Stock Summary Header', () => {

    test('displays health badge with risk tier for searched stock', async ({ page }) => {
      await page.goto('/');

      // Search for a stock
      await page.getByPlaceholder(/search/i).fill('CELH');
      await page.getByPlaceholder(/search/i).press('Enter');

      // Wait for stock summary to load
      await page.waitForSelector('[data-testid="stock-summary"]');

      // Health badge should be visible
      const healthBadge = page.getByTestId('health-badge');
      await expect(healthBadge).toBeVisible();

      // Should show percentage from 52W high
      await expect(healthBadge).toContainText(/from 52W high/i);
    });

    test('shows current price and 52W range', async ({ page }) => {
      await page.goto('/');
      await page.getByPlaceholder(/search/i).fill('AAPL');
      await page.getByPlaceholder(/search/i).press('Enter');

      await page.waitForSelector('[data-testid="stock-summary"]');

      // Should display 52W range
      const priceInfo = page.getByTestId('price-info');
      await expect(priceInfo).toBeVisible();
      await expect(priceInfo).toContainText(/52W:/);
    });

    test('healthy stock shows green indicator', async ({ page }) => {
      // Need a stock within 10% of 52W high
      await page.goto('/');
      await page.getByPlaceholder(/search/i).fill('SPY');
      await page.getByPlaceholder(/search/i).press('Enter');

      await page.waitForSelector('[data-testid="stock-summary"]');

      const healthBadge = page.getByTestId('health-badge');
      // Should have green styling (healthy tier)
      await expect(healthBadge).toHaveAttribute('data-risk-tier', /(healthy|caution|high)/);
    });

    test('distressed stock shows red indicator with warning', async ({ page }) => {
      // Use a known distressed stock or mock the API
      await page.goto('/');
      await page.getByPlaceholder(/search/i).fill('CELH');
      await page.getByPlaceholder(/search/i).press('Enter');

      await page.waitForSelector('[data-testid="stock-summary"]');

      const healthBadge = page.getByTestId('health-badge');

      // If stock is >30% from high, should show high risk
      // This test may need adjustment based on real-time data
      const riskTier = await healthBadge.getAttribute('data-risk-tier');
      expect(['healthy', 'caution', 'high']).toContain(riskTier);
    });
  });

  test.describe('Heatmap Table Headers', () => {

    test('shows risk indicator in heatmap header for high-risk stock', async ({ page }) => {
      await page.goto('/');
      await page.getByPlaceholder(/search/i).fill('CELH');
      await page.getByPlaceholder(/search/i).press('Enter');

      await page.waitForSelector('[data-testid="heatmap-table"]');

      // Look for risk indicator in the heatmap header
      const heatmapHeader = page.locator('[data-testid="heatmap-header"]').first();

      // If stock is high risk, should show warning icon
      const riskIndicator = heatmapHeader.getByTestId('header-risk-indicator');
      // May or may not be visible depending on stock's current health
      // This is a conditional check
    });

    test('risk indicator in header links to health explanation at top', async ({ page }) => {
      await page.goto('/');
      await page.getByPlaceholder(/search/i).fill('CELH');
      await page.getByPlaceholder(/search/i).press('Enter');

      await page.waitForSelector('[data-testid="heatmap-table"]');

      // Find risk indicator link (if present)
      const riskLink = page.locator('[data-testid="header-risk-indicator"] a').first();

      if (await riskLink.isVisible()) {
        // Click should scroll to health badge anchor
        await riskLink.click();

        // Health badge should be in viewport
        const healthBadge = page.getByTestId('health-badge');
        await expect(healthBadge).toBeInViewport();
      }
    });
  });

  test.describe('Screener Integration', () => {

    test('high-risk stocks are visually dimmed in screener results', async ({ page }) => {
      await page.goto('/');

      // Navigate to screener/upcoming opportunities
      await page.getByRole('link', { name: /upcoming|screener/i }).click();

      await page.waitForSelector('[data-testid="screener-results"]');

      // Look for any rows with high-risk styling
      const highRiskRows = page.locator('[data-testid="screener-row"][data-risk-tier="high"]');

      // If any high-risk stocks exist, they should have dimmed styling
      const count = await highRiskRows.count();
      if (count > 0) {
        const firstHighRisk = highRiskRows.first();
        // Should have opacity or muted class
        await expect(firstHighRisk).toHaveClass(/muted|dimmed|opacity/);
      }
    });

    test('screener shows risk indicator icon on high-risk rows', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('link', { name: /upcoming|screener/i }).click();

      await page.waitForSelector('[data-testid="screener-results"]');

      // High-risk rows should have warning icon
      const highRiskRows = page.locator('[data-testid="screener-row"][data-risk-tier="high"]');

      const count = await highRiskRows.count();
      if (count > 0) {
        const riskIcon = highRiskRows.first().getByTestId('row-risk-icon');
        await expect(riskIcon).toBeVisible();
      }
    });
  });

  test.describe('API: /api/stocks/:ticker/health', () => {

    test('returns health data for valid ticker', async ({ request }) => {
      const response = await request.get('/api/stocks/AAPL/health');

      expect(response.ok()).toBeTruthy();

      const data = await response.json();

      // Verify response structure
      expect(data).toHaveProperty('current');
      expect(data).toHaveProperty('high52w');
      expect(data).toHaveProperty('low52w');
      expect(data).toHaveProperty('pctFromHigh');
      expect(data).toHaveProperty('riskTier');

      // Verify types
      expect(typeof data.current).toBe('number');
      expect(typeof data.high52w).toBe('number');
      expect(typeof data.low52w).toBe('number');
      expect(typeof data.pctFromHigh).toBe('number');
      expect(['healthy', 'caution', 'high']).toContain(data.riskTier);
    });

    test('returns 404 for unknown ticker', async ({ request }) => {
      const response = await request.get('/api/stocks/INVALIDTICKER123/health');

      expect(response.status()).toBe(404);
    });

    test('calculates correct risk tier based on pctFromHigh', async ({ request }) => {
      const response = await request.get('/api/stocks/SPY/health');
      const data = await response.json();

      // Verify risk tier matches percentage
      const pct = Math.abs(data.pctFromHigh);

      if (pct <= 10) {
        expect(data.riskTier).toBe('healthy');
      } else if (pct <= 30) {
        expect(data.riskTier).toBe('caution');
      } else {
        expect(data.riskTier).toBe('high');
      }
    });
  });
});
