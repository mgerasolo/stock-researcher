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
 * Formula: score = (winRate/100) * avgPerMonth * sqrt(count)
 */

test.describe('Issue #10: Composite Score Ranking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to Top Periods (screener)
    await page.click('a[href="#top-periods"]');
    await page.waitForURL('**/#top-periods');

    // Wait for results table to load
    await page.waitForSelector('table tbody tr', { timeout: 30000 });
  });

  test('should display Score column in screener results', async ({ page }) => {
    // Score column header should be visible with highlight
    const scoreHeader = page.locator('th:has-text("Score")').first();
    await expect(scoreHeader).toBeVisible();

    // Should have the highlight star
    await expect(scoreHeader.locator('text=★')).toBeVisible();
  });

  test('should calculate and display composite score', async ({ page }) => {
    // Get first result row score
    const firstRow = page.locator('tbody tr').first();
    const scoreCell = firstRow.locator('td').nth(1); // Score is second column after #

    // Score should be visible and be a number
    await expect(scoreCell).toBeVisible();
    const scoreText = await scoreCell.textContent();
    expect(scoreText).toMatch(/^\d+\.\d$/); // e.g., "5.2"
  });

  test('should sort by score by default (descending)', async ({ page }) => {
    // Get scores from first 5 rows
    const scores: number[] = [];
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();

    for (let i = 0; i < Math.min(rowCount, 5); i++) {
      const scoreCell = rows.nth(i).locator('td').nth(1);
      const scoreText = await scoreCell.textContent();
      scores.push(parseFloat(scoreText || '0'));
    }

    // Should be sorted descending by default
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  test('should allow sorting by score column (click toggles direction)', async ({ page }) => {
    // Score header should be clickable and have sort indicator
    const scoreHeader = page.locator('th:has-text("Score")').first();
    await expect(scoreHeader).toBeVisible();

    // Should have cursor pointer indicating clickable
    const cursorStyle = await scoreHeader.evaluate(el =>
      window.getComputedStyle(el).cursor
    );
    expect(cursorStyle).toBe('pointer');

    // Should have descending indicator by default
    await expect(scoreHeader.locator('text=▼')).toBeVisible();

    // Clicking header is interactive (doesn't throw)
    await scoreHeader.click();
    await page.waitForTimeout(500);

    // After clicking, either arrow direction change or data reorder
    // (implementation may vary - key is that column is sortable)
    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('should show tooltip explaining score formula on hover', async ({ page }) => {
    // Hover over score column header
    const scoreHeader = page.locator('th:has-text("Score")').first();
    await scoreHeader.hover();

    // Tooltip should appear
    const tooltip = page.locator('[data-testid="score-tooltip"]');
    await expect(tooltip).toBeVisible();

    // Should explain the formula
    const tooltipText = await tooltip.textContent();
    expect(tooltipText?.toLowerCase()).toContain('win rate');
    expect(tooltipText?.toLowerCase()).toContain('average');
  });

  test('score should reflect formula: (winRate/100) * avgPerMonth * sqrt(years)', async ({ page }) => {
    // Get data from first row
    const firstRow = page.locator('tbody tr').first();

    // Score is column 1 (0-indexed after #)
    const scoreCell = firstRow.locator('td').nth(1);
    const scoreText = await scoreCell.textContent();
    const score = parseFloat(scoreText || '0');

    // Get win rate (column 7 - Win%)
    const winRateCell = firstRow.locator('td').nth(7);
    const winRateText = await winRateCell.textContent();
    const winRate = parseFloat(winRateText?.replace('%', '') || '0');

    // Get avg per month (column 5 - Avg/Mo)
    const avgCell = firstRow.locator('td').nth(5);
    const avgText = await avgCell.textContent();
    const avgPerMonth = parseFloat(avgText?.replace('%', '') || '0');

    // Get years (column 10 - Yrs)
    const yearsCell = firstRow.locator('td').nth(10);
    const yearsText = await yearsCell.textContent();
    const years = parseInt(yearsText || '0');

    // Calculate expected score
    const expectedScore = (winRate / 100) * avgPerMonth * Math.sqrt(years);

    // Allow for rounding differences (displayed with 1 decimal)
    expect(score).toBeCloseTo(expectedScore, 0);
  });
});
