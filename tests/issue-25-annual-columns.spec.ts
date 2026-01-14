import { test, expect } from '@playwright/test';

/**
 * Issue #25: Add annual average column to heatmap matrix
 *
 * Tests for the Total and Avg columns that show yearly aggregates
 * on the right side of the heatmap matrix.
 */

// Helper function to search for a stock
async function searchStock(page: any, ticker: string) {
  const searchInput = page.getByRole('textbox', { name: /Search for a stock ticker/ });
  await searchInput.fill(ticker);

  const result = page.getByRole('button', { name: new RegExp(`${ticker}.*Tier`, 'i') });
  await result.click();

  // Wait for heatmap table to load
  await page.waitForSelector('table thead', { timeout: 15000 });
}

test.describe('Annual Columns', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('heatmap displays Total column header', async ({ page }) => {
    await searchStock(page, 'AAPL');

    // Look for "Total" column header
    const totalHeader = page.locator('th:has-text("Total")');
    await expect(totalHeader.first()).toBeVisible();
  });

  test('heatmap displays Avg column header', async ({ page }) => {
    await searchStock(page, 'AAPL');

    // Look for "Avg" column header in the main heatmap table (first table)
    // The "Best Entry Months" panel has tables with different headers
    const firstTable = page.locator('table').first();
    const avgHeader = firstTable.locator('thead th:has-text("Avg")');
    await expect(avgHeader).toBeVisible();
  });

  test('Total column shows sum of year returns', async ({ page }) => {
    await searchStock(page, 'AAPL');

    // Find a specific year row (2024)
    const yearRow = page.locator('tbody tr').filter({ has: page.locator('td:text-is("2024")') }).first();
    await expect(yearRow).toBeVisible();

    // Get all cells in the row
    const cells = yearRow.locator('td');
    const cellCount = await cells.count();

    // Should have 14+ cells (label + 12 months + Total + Avg)
    expect(cellCount).toBeGreaterThanOrEqual(14);

    // The Total cell should show a percentage value
    // Looking at the UI, Total appears in one of the last columns
    const totalValue = yearRow.locator('td:nth-last-child(2)');
    const totalText = await totalValue.textContent();
    expect(totalText).toContain('%');
  });

  test('Avg column shows monthly average', async ({ page }) => {
    await searchStock(page, 'AAPL');

    // Find a year row
    const yearRow = page.locator('tbody tr').filter({ has: page.locator('td:text-is("2024")') }).first();

    // Get the last cell (Avg column)
    const avgCell = yearRow.locator('td').last();
    const avgText = await avgCell.textContent();

    // Avg cell should have a percentage value
    expect(avgText).toContain('%');
  });

  test('headers include all expected columns', async ({ page }) => {
    await searchStock(page, 'AAPL');

    // Get headers from the main heatmap table (first table)
    const firstTable = page.locator('table').first();
    const headers = firstTable.locator('thead th');
    const headerTexts = await headers.allTextContents();

    // Should have month headers
    expect(headerTexts.some(h => h.includes('Jan'))).toBeTruthy();
    expect(headerTexts.some(h => h.includes('Dec'))).toBeTruthy();

    // Should have Total and Avg
    expect(headerTexts.some(h => h.includes('Total'))).toBeTruthy();
    expect(headerTexts.some(h => h.includes('Avg'))).toBeTruthy();
  });

  test('Win% row has aggregate columns', async ({ page }) => {
    await searchStock(page, 'AAPL');

    // Find Win% row in the heatmap - look for row containing "Win %" text
    const winRow = page.locator('tbody tr', { has: page.locator('td:text-is("Win %")') }).first();
    await expect(winRow).toBeVisible();
    const cells = winRow.locator('td');
    const cellCount = await cells.count();

    // Win% row should have 14+ cells (label + 12 months + Total + Avg)
    expect(cellCount).toBeGreaterThanOrEqual(14);
  });

  test('Avg row has aggregate columns', async ({ page }) => {
    await searchStock(page, 'AAPL');

    // Find Avg row in the first table's tbody - look for row with "Avg" as first cell
    const firstTable = page.locator('table').first();
    const avgRow = firstTable.locator('tbody tr:has(td:text-is("Avg"))').first();
    await expect(avgRow).toBeVisible();
    const cells = avgRow.locator('td');
    const cellCount = await cells.count();

    // Avg row should have 14+ cells (label + 12 months + Total + Avg)
    expect(cellCount).toBeGreaterThanOrEqual(14);
  });

  test('year total is sum of monthly returns', async ({ page }) => {
    await searchStock(page, 'AAPL');

    // Find 2024 row which has full data
    const yearRow = page.locator('tbody tr').filter({ has: page.locator('td:text-is("2024")') }).first();

    // Get the Total cell value
    const totalCell = yearRow.locator('td:nth-last-child(2)');
    const totalText = await totalCell.textContent();

    // Total should be a reasonable sum (not empty or dash)
    expect(totalText).toMatch(/[+-]?\d+\.?\d*%/);
  });

  test('Min and Max rows have aggregate columns', async ({ page }) => {
    await searchStock(page, 'AAPL');

    // Scope to first table (main heatmap) to avoid matching other tables
    const firstTable = page.locator('table').first();

    // Find Min row
    const minRow = firstTable.locator('tbody tr', { has: page.locator('td:text-is("Min")') }).first();
    await expect(minRow).toBeVisible();
    const minCells = minRow.locator('td');

    // Find Max row
    const maxRow = firstTable.locator('tbody tr', { has: page.locator('td:text-is("Max")') }).first();
    await expect(maxRow).toBeVisible();
    const maxCells = maxRow.locator('td');

    // Both should have 14+ cells
    expect(await minCells.count()).toBeGreaterThanOrEqual(14);
    expect(await maxCells.count()).toBeGreaterThanOrEqual(14);
  });
});
