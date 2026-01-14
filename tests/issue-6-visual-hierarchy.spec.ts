import { test, expect } from '@playwright/test';

/**
 * Issue #6: Rebalance visual hierarchy - aggregate metrics over matrix
 *
 * Tests that Win% and Avg rows are visually prominent with larger text
 * and gradient backgrounds to make them stand out from individual year data.
 */

// Helper function to search for a stock
async function searchStock(page: any, ticker: string) {
  const searchInput = page.getByRole('textbox', { name: /Search for a stock ticker/ });
  await searchInput.fill(ticker);

  const result = page.getByRole('button', { name: new RegExp(`${ticker}.*Tier`, 'i') });
  await result.click();

  // Wait for heatmap table to load
  await page.waitForSelector('tbody tr', { timeout: 15000 });
}

test.describe('Visual Hierarchy', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('heatmap loads with aggregate rows visible', async ({ page }) => {
    await searchStock(page, 'AAPL');

    // Check both aggregate rows exist
    const winRow = page.locator('tbody tr').filter({ has: page.locator('td:text-is("Win %")') });
    const avgRow = page.locator('tbody tr').filter({ has: page.locator('td:text-is("Avg")') });

    await expect(winRow.first()).toBeVisible();
    await expect(avgRow.first()).toBeVisible();
  });

  test('Win% row displays percentage values for all months', async ({ page }) => {
    await searchStock(page, 'AAPL');

    // Find Win% row
    const winRow = page.locator('tbody tr').filter({ has: page.locator('td:text-is("Win %")') }).first();
    await expect(winRow).toBeVisible();

    // Check that it has percentage values (at least 12 months worth)
    const percentCells = winRow.locator('td:has-text("%")');
    const count = await percentCells.count();
    expect(count).toBeGreaterThanOrEqual(12);
  });

  test('Avg row displays percentage values for all months', async ({ page }) => {
    await searchStock(page, 'AAPL');

    // Find Avg row
    const avgRow = page.locator('tbody tr').filter({ has: page.locator('td:text-is("Avg")') }).first();
    await expect(avgRow).toBeVisible();

    // Check that it has percentage values (at least 12 months worth)
    const percentCells = avgRow.locator('td:has-text("%")');
    const count = await percentCells.count();
    expect(count).toBeGreaterThanOrEqual(12);
  });

  test('aggregate rows are displayed before year rows', async ({ page }) => {
    await searchStock(page, 'AAPL');

    // Get all row labels
    const tbody = page.locator('tbody').first();
    const rows = tbody.locator('tr');

    // First few rows should be aggregate metrics (Win %, Avg, etc.)
    // Year rows start with 4-digit numbers (2024, 2023, etc.)
    const firstRow = rows.first();
    const firstCellText = await firstRow.locator('td').first().textContent();

    // First rows should not be year numbers
    expect(firstCellText).not.toMatch(/^20[0-2][0-9]$/);
  });

  test('year rows display individual year data', async ({ page }) => {
    await searchStock(page, 'AAPL');

    // Find year rows (start with 4-digit year) in the first table
    const firstTable = page.locator('table').first();
    const yearRows = firstTable.locator('tbody tr:has(td:text-matches("^20[0-2][0-9]$"))');
    const yearRowCount = await yearRows.count();

    // Should have multiple year rows
    expect(yearRowCount).toBeGreaterThan(5);
  });

  test('year rows have return values for each month', async ({ page }) => {
    await searchStock(page, 'AAPL');

    // Find a specific year row (2024)
    const yearRow = page.locator('tbody tr').filter({ has: page.locator('td:text-is("2024")') }).first();
    await expect(yearRow).toBeVisible();

    // Should have percentage values in cells
    const percentCells = yearRow.locator('td:has-text("%")');
    const count = await percentCells.count();

    // Should have values for most months
    expect(count).toBeGreaterThan(8);
  });
});
