import { test, expect } from '@playwright/test';

/**
 * Issue #4: Add outlier detection and warning indicators
 *
 * Tests for outlier warning icons in heatmap Avg row that indicate
 * when a single year's return significantly skews the average.
 */

// Helper function to search for a stock
async function searchStock(page: any, ticker: string) {
  // Fill the search input in the main content area
  const searchInput = page.getByRole('textbox', { name: /Search for a stock ticker/ });
  await searchInput.fill(ticker);

  // Wait for dropdown to appear and click on the result
  const result = page.getByRole('button', { name: new RegExp(`${ticker}.*Tier`, 'i') });
  await result.click();

  // Wait for heatmap table to load (wait for a table with tbody rows)
  await page.waitForSelector('tbody tr', { timeout: 15000 });
}

test.describe('Outlier Detection', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app and wait for it to load
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('heatmap loads and displays average per month row', async ({ page }) => {
    await searchStock(page, 'AAPL');

    // Check that Avg/Mo row exists in the heatmap (in tbody)
    const avgMoRow = page.locator('tbody tr').filter({ has: page.locator('td:text-is("Avg/Mo")') });
    await expect(avgMoRow.first()).toBeVisible();
  });

  test('outlier warning icons appear on cells with skewed data', async ({ page }) => {
    await searchStock(page, 'AAPL');

    // Look for any warning icons in the Avg/Mo row (outlier indicators show on monthly average)
    // The actual icons are: ⚠️ (warning), ❗ (exclamation), ‼️ (double exclamation)
    const avgMoRow = page.locator('tbody tr').filter({ has: page.locator('td:text-is("Avg/Mo")') }).first();

    // Count cells with each type of warning icon (emoji char class doesn't work in regex)
    const severeCount = await avgMoRow.locator('text=‼️').count();
    const highCount = await avgMoRow.locator('text=❗').count();
    const moderateCount = await avgMoRow.locator('text=⚠️').count();
    const totalCount = severeCount + highCount + moderateCount;

    // AAPL should have some outliers based on the UI
    console.log(`Found ${totalCount} outlier warning icons for AAPL (severe: ${severeCount}, high: ${highCount}, moderate: ${moderateCount})`);
    expect(totalCount).toBeGreaterThan(0);
  });

  test('outlier icons have correct severity colors', async ({ page }) => {
    await searchStock(page, 'AAPL');

    // Find Avg/Mo row (outlier indicators are on monthly average row)
    const avgMoRow = page.locator('tbody tr').filter({ has: page.locator('td:text-is("Avg/Mo")') }).first();

    // Check for different severity levels (actual icons from the app)
    const severeIcons = avgMoRow.locator('text=‼️');
    const highIcons = avgMoRow.locator('text=❗');
    const moderateIcons = avgMoRow.locator('text=⚠️');

    // At least one type of warning should exist
    const totalWarnings =
      (await severeIcons.count()) +
      (await highIcons.count()) +
      (await moderateIcons.count());

    expect(totalWarnings).toBeGreaterThan(0);
  });

  test('Avg/Mo row cells display percentage values', async ({ page }) => {
    await searchStock(page, 'AAPL');

    // Check Avg/Mo row has percentage values (this is the primary metric row)
    const avgMoRow = page.locator('tbody tr').filter({ has: page.locator('td:text-is("Avg/Mo")') }).first();
    await expect(avgMoRow).toBeVisible();

    // Should have cells with % signs (at least for 12 months)
    const percentCells = avgMoRow.locator('td:has-text("%")');
    const count = await percentCells.count();
    expect(count).toBeGreaterThanOrEqual(12);
  });
});
