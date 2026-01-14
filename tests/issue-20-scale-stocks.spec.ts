import { test, expect } from '@playwright/test';

/**
 * Issue #20: Scale to 5,000+ US stocks
 *
 * Acceptance Criteria:
 * - Ingest all US exchange tickers
 * - Database handles ~1M+ records efficiently
 * - Screener returns results in <90 seconds
 * - Consider: indexing, partitioning, caching
 */

test.describe('Issue #20: Scale to 5,000+ US Stocks', () => {
  test('should have search autocomplete for wide range of tickers', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByRole('textbox', { name: /Search for a stock ticker/ });

    // Search for a less common ticker
    await searchInput.fill('ZTS'); // Zoetis - not a top 100 stock
    await page.waitForTimeout(1000);

    // Should find it in autocomplete
    const result = page.getByRole('button', { name: /ZTS/i });
    await expect(result).toBeVisible({ timeout: 5000 });
  });

  test('should handle NYSE tickers', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByRole('textbox', { name: /Search for a stock ticker/ });

    // Search for NYSE ticker
    await searchInput.fill('IBM');
    await page.waitForTimeout(1000);

    const result = page.getByRole('button', { name: /IBM/i });
    await expect(result).toBeVisible();
  });

  test('should handle NASDAQ tickers', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByRole('textbox', { name: /Search for a stock ticker/ });

    // Search for NASDAQ ticker
    await searchInput.fill('CSCO');
    await page.waitForTimeout(1000);

    const result = page.getByRole('button', { name: /CSCO/i });
    await expect(result).toBeVisible();
  });

  test('screener should return results within 90 seconds', async ({ page }) => {
    await page.goto('/');
    await page.click('a:has-text("Screener")');
    await page.waitForURL('**/#screener');

    const startTime = Date.now();

    // Run a broad screener search
    await page.click('[data-testid="screener-search-button"], button:has-text("Search"), button:has-text("Scan")');

    // Wait for results
    await page.waitForSelector('[data-testid="screener-results"], table', { timeout: 90000 });

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    // Should complete within 90 seconds
    expect(duration).toBeLessThan(90);
  });

  test('screener results should be paginated', async ({ page }) => {
    await page.goto('/');
    await page.click('a:has-text("Screener")');
    await page.waitForURL('**/#screener');

    await page.click('[data-testid="screener-search-button"], button:has-text("Search"), button:has-text("Scan")');
    await page.waitForSelector('[data-testid="screener-results"], table', { timeout: 90000 });

    // Should have pagination controls
    const pagination = page.locator('[data-testid="pagination"], nav:has(button:has-text("Next")), text=/page.*of/i');
    await expect(pagination).toBeVisible();
  });

  test('should show stock count in UI', async ({ page }) => {
    await page.goto('/');

    // Should display total stock count somewhere
    const stockCount = page.locator('text=/\\d{3,}.*stocks|stocks.*\\d{3,}/i');

    // May be visible on home page or screener
    if (!await stockCount.isVisible()) {
      await page.click('a:has-text("Screener")');
      await page.waitForURL('**/#screener');
    }

    await expect(stockCount).toBeVisible({ timeout: 10000 });
  });

  test('API should handle concurrent requests', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Make multiple concurrent searches
    const requests: Promise<any>[] = [];

    for (const ticker of ['AAPL', 'MSFT', 'GOOGL']) {
      requests.push(
        page.evaluate(async (t) => {
          const response = await fetch(`/api/prices?ticker=${t}`);
          return response.status;
        }, ticker)
      );
    }

    const results = await Promise.all(requests);

    // All should succeed
    results.forEach(status => {
      expect(status).toBe(200);
    });
  });
});
