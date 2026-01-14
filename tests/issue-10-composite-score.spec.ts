import { test, expect } from '@playwright/test';

/**
 * Issue #10: Add composite score ranking to screener
 *
 * Acceptance Criteria:
 * - Calculate composite score: win rate × avg return × consistency
 * - Add "Score" column to results table
 * - Allow sorting by composite score
 * - Consider making it the default sort
 * - Document scoring formula in UI tooltip
 *
 * Formula: score = (winRate/100) * avgPerMonth * sqrt(yearsOfData)
 */

test.describe('Issue #10: Composite Score Ranking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Navigate to screener page
    await page.click('[data-testid="nav-screener"]');
    await page.waitForSelector('[data-testid="screener-page"]', { timeout: 10000 });
  });

  test('should display Score column in screener results', async ({ page }) => {
    // Run a screener search
    await page.click('[data-testid="screener-search-button"]');
    await page.waitForSelector('[data-testid="screener-results"]', { timeout: 15000 });

    // Score column should be visible
    const scoreHeader = page.locator('[data-testid="column-header-score"]');
    await expect(scoreHeader).toBeVisible();
  });

  test('should calculate composite score correctly', async ({ page }) => {
    await page.click('[data-testid="screener-search-button"]');
    await page.waitForSelector('[data-testid="screener-results"]', { timeout: 15000 });

    // Get first result row data
    const firstRow = page.locator('[data-testid="screener-result-row"]').first();

    const winRate = await firstRow.locator('[data-testid="cell-win-rate"]').textContent();
    const avgReturn = await firstRow.locator('[data-testid="cell-avg-return"]').textContent();
    const yearsData = await firstRow.locator('[data-testid="cell-years"]').textContent();
    const score = await firstRow.locator('[data-testid="cell-score"]').textContent();

    // Parse values
    const winRateNum = parseFloat(winRate?.replace('%', '') || '0');
    const avgReturnNum = parseFloat(avgReturn?.replace('%', '') || '0');
    const yearsNum = parseInt(yearsData || '0');
    const scoreNum = parseFloat(score || '0');

    // Calculate expected score: (winRate/100) * avgPerMonth * sqrt(yearsOfData)
    const expectedScore = (winRateNum / 100) * avgReturnNum * Math.sqrt(yearsNum);

    // Allow small floating point difference
    expect(scoreNum).toBeCloseTo(expectedScore, 1);
  });

  test('should allow sorting by score column', async ({ page }) => {
    await page.click('[data-testid="screener-search-button"]');
    await page.waitForSelector('[data-testid="screener-results"]', { timeout: 15000 });

    // Click score header to sort
    const scoreHeader = page.locator('[data-testid="column-header-score"]');
    await scoreHeader.click();

    // Get scores after sorting descending
    const scores: number[] = [];
    const rows = page.locator('[data-testid="screener-result-row"]');
    const rowCount = await rows.count();

    for (let i = 0; i < Math.min(rowCount, 5); i++) {
      const scoreText = await rows.nth(i).locator('[data-testid="cell-score"]').textContent();
      scores.push(parseFloat(scoreText || '0'));
    }

    // Verify sorted descending
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  test('should show tooltip explaining score formula', async ({ page }) => {
    await page.click('[data-testid="screener-search-button"]');
    await page.waitForSelector('[data-testid="screener-results"]', { timeout: 15000 });

    // Hover over score column header
    const scoreHeader = page.locator('[data-testid="column-header-score"]');
    await scoreHeader.hover();

    // Tooltip should explain the formula
    const tooltip = page.locator('[data-testid="score-tooltip"]');
    await expect(tooltip).toBeVisible();

    const tooltipText = await tooltip.textContent();
    expect(tooltipText).toContain('win rate');
    expect(tooltipText).toContain('average');
  });

  test('should use score as default sort', async ({ page }) => {
    await page.click('[data-testid="screener-search-button"]');
    await page.waitForSelector('[data-testid="screener-results"]', { timeout: 15000 });

    // Check that score column is marked as sorted by default
    const scoreHeader = page.locator('[data-testid="column-header-score"]');
    await expect(scoreHeader).toHaveAttribute('data-sorted', 'desc');

    // Verify results are actually sorted by score
    const scores: number[] = [];
    const rows = page.locator('[data-testid="screener-result-row"]');
    const rowCount = await rows.count();

    for (let i = 0; i < Math.min(rowCount, 5); i++) {
      const scoreText = await rows.nth(i).locator('[data-testid="cell-score"]').textContent();
      scores.push(parseFloat(scoreText || '0'));
    }

    // Should be sorted descending by default
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });
});
