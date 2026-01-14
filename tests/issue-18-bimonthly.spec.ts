import { test, expect } from '@playwright/test';

/**
 * Issue #18: Bi-monthly data granularity
 *
 * Acceptance Criteria:
 * - Data pipeline calculates bi-monthly close_max
 * - Database schema supports bi-monthly periods
 * - Heatmap can display bi-monthly view
 * - Screener can filter by bi-monthly periods
 * - 2x data volume handled efficiently
 */

test.describe('Issue #18: Bi-monthly Data Granularity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByRole('textbox', { name: /Search for a stock ticker/ });
    await searchInput.fill('AAPL');
    const result = page.getByRole('button', { name: /AAPL.*Tier/i });
    await result.click();
    await page.waitForSelector('text=Best Entry Months', { timeout: 15000 });
  });

  test('should have bi-monthly toggle option', async ({ page }) => {
    // Look for granularity toggle
    const bimonthlyToggle = page.locator('button:has-text("Bi-monthly"), [data-testid="granularity-toggle"]');
    await expect(bimonthlyToggle).toBeVisible();
  });

  test('should display bi-monthly view when toggled', async ({ page }) => {
    const bimonthlyToggle = page.locator('button:has-text("Bi-monthly"), [data-testid="granularity-toggle"]');
    await bimonthlyToggle.click();
    await page.waitForTimeout(500);

    // Should now show 24 columns instead of 12 (two periods per month)
    const columnHeaders = page.locator('[data-testid^="period-header-"], .period-header');
    const count = await columnHeaders.count();

    // Bi-monthly = 24 periods (Jan-A, Jan-B, Feb-A, Feb-B, etc.)
    expect(count).toBe(24);
  });

  test('should label bi-monthly periods correctly', async ({ page }) => {
    const bimonthlyToggle = page.locator('button:has-text("Bi-monthly"), [data-testid="granularity-toggle"]');
    await bimonthlyToggle.click();
    await page.waitForTimeout(500);

    // Should have Jan-A (1st-15th) and Jan-B (16th-end) labels
    const janA = page.locator('text=/Jan.*A|Jan.*1st|Jan 1-15/i');
    const janB = page.locator('text=/Jan.*B|Jan.*16th|Jan 16-/i');

    await expect(janA).toBeVisible();
    await expect(janB).toBeVisible();
  });

  test('should show bi-monthly data in heatmap cells', async ({ page }) => {
    const bimonthlyToggle = page.locator('button:has-text("Bi-monthly"), [data-testid="granularity-toggle"]');
    await bimonthlyToggle.click();
    await page.waitForTimeout(1000);

    // Cells should contain data
    const cells = page.locator('[data-testid^="heatmap-cell-"], .heatmap-cell');
    const count = await cells.count();

    // Should have cells for bi-monthly periods
    expect(count).toBeGreaterThan(0);
  });

  test('should switch back to monthly view', async ({ page }) => {
    // Toggle to bi-monthly
    const bimonthlyToggle = page.locator('button:has-text("Bi-monthly"), [data-testid="granularity-toggle"]');
    await bimonthlyToggle.click();
    await page.waitForTimeout(500);

    // Toggle back to monthly
    const monthlyToggle = page.locator('button:has-text("Monthly"), [data-testid="monthly-toggle"]');
    await monthlyToggle.click();
    await page.waitForTimeout(500);

    // Should show 12 months again
    const monthHeaders = page.locator('[data-testid^="month-header-"]');
    const count = await monthHeaders.count();
    expect(count).toBe(12);
  });

  test('screener should support bi-monthly filtering', async ({ page }) => {
    // Navigate to screener
    await page.click('a:has-text("Screener")');
    await page.waitForURL('**/#screener');

    // Look for bi-monthly filter option
    const periodFilter = page.locator('[data-testid="period-filter"], select:has-text("Period")');

    if (await periodFilter.isVisible()) {
      // Should have bi-monthly options
      const options = await periodFilter.locator('option').allTextContents();
      const hasBimonthly = options.some(opt => /bi-monthly|half|1st|16th/i.test(opt));
      expect(hasBimonthly).toBe(true);
    }
  });

  test('bi-monthly view should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    const bimonthlyToggle = page.locator('button:has-text("Bi-monthly"), [data-testid="granularity-toggle"]');
    await bimonthlyToggle.click();

    // Wait for heatmap to update
    await page.waitForSelector('[data-testid^="heatmap-cell-"], .heatmap-cell', { timeout: 10000 });

    const loadTime = Date.now() - startTime;

    // Should load within 5 seconds even with 2x data
    expect(loadTime).toBeLessThan(5000);
  });
});
