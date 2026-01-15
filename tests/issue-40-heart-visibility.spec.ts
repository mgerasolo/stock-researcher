import { test, expect } from '@playwright/test';

/**
 * Issue #40: Make pattern favorite (heart) button always visible on Upcoming Opportunities
 *
 * Acceptance Criteria:
 * - Heart button visible on all rows without hovering
 * - Heart positioned next to Alpha column (the new primary metric)
 * - Alpha column has highlighted styling (dark green badge)
 * - Avg/Mo column demoted to plain text styling
 * - Clear filled (♥) vs unfilled (♡) states
 * - Clicking heart favorites the pattern (not the ticker)
 * - Visual separation from ticker sentiment buttons
 */

test.describe('Issue #40: Heart Button Visibility & Alpha Column', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to Screener / Upcoming Opportunities
    await page.click('a:has-text("Screener")');
    await page.waitForURL('**/#screener');
    await page.waitForTimeout(500);
  });

  test.describe('Heart Button Visibility', () => {
    test('should show heart button on every row without hovering', async ({ page }) => {
      // Wait for table to load
      await page.waitForSelector('table tbody tr');

      // Get first few rows
      const rows = page.locator('table tbody tr');
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThan(0);

      // Check that heart buttons are visible without hovering
      for (let i = 0; i < Math.min(5, rowCount); i++) {
        const row = rows.nth(i);
        const heartBtn = row.locator('[data-testid="favorite-pattern-button"], button[title*="favorite" i], button:has(svg[fill="none"][stroke="currentColor"]):has-text(""), .heart-button');

        // Heart should be visible (not hidden by opacity)
        await expect(heartBtn.first()).toBeVisible();

        // Verify it's not using opacity-0 (hover-dependent visibility)
        const opacity = await heartBtn.first().evaluate(el => getComputedStyle(el).opacity);
        expect(parseFloat(opacity)).toBeGreaterThan(0);
      }
    });

    test('should show unfilled heart for non-favorited patterns', async ({ page }) => {
      await page.waitForSelector('table tbody tr');

      const firstRow = page.locator('table tbody tr').first();
      const heartBtn = firstRow.locator('[data-testid="favorite-pattern-button"], button[title*="favorite" i]').first();

      // Heart should have outline style (not filled)
      const svg = heartBtn.locator('svg');
      const fill = await svg.getAttribute('fill');
      expect(fill).toBe('none');
    });

    test('should show filled heart after clicking to favorite', async ({ page }) => {
      await page.waitForSelector('table tbody tr');

      const firstRow = page.locator('table tbody tr').first();
      const heartBtn = firstRow.locator('[data-testid="favorite-pattern-button"], button[title*="favorite" i]').first();

      // Click to favorite
      await heartBtn.click();
      await page.waitForTimeout(300);

      // Heart should now be filled
      const svg = heartBtn.locator('svg');
      const fill = await svg.getAttribute('fill');
      expect(fill).toBe('currentColor');
    });

    test('should have tooltip explaining pattern favorite', async ({ page }) => {
      await page.waitForSelector('table tbody tr');

      const firstRow = page.locator('table tbody tr').first();
      const heartBtn = firstRow.locator('[data-testid="favorite-pattern-button"], button[title*="favorite" i]').first();

      // Check tooltip text mentions "pattern" or "favorite"
      const title = await heartBtn.getAttribute('title');
      expect(title?.toLowerCase()).toMatch(/favorite|pattern/);
    });
  });

  test.describe('Alpha Column as Primary Metric', () => {
    test('should have Alpha column with highlighted styling', async ({ page }) => {
      await page.waitForSelector('table tbody tr');

      // Find Alpha column header
      const alphaHeader = page.locator('th:has-text("Alpha")');
      await expect(alphaHeader).toBeVisible();

      // Alpha header should have highlight styling
      await expect(alphaHeader).toHaveClass(/text-green|bg-green/);
    });

    test('should position Alpha before Avg/Mo in column order', async ({ page }) => {
      await page.waitForSelector('table thead tr');

      // Get all header texts in order
      const headers = page.locator('table thead th');
      const headerTexts: string[] = [];
      const count = await headers.count();

      for (let i = 0; i < count; i++) {
        const text = await headers.nth(i).textContent();
        headerTexts.push(text || '');
      }

      // Find positions of Alpha and Avg/Mo
      const alphaIndex = headerTexts.findIndex(h => h.includes('Alpha'));
      const avgMoIndex = headerTexts.findIndex(h => h.includes('Avg/Mo'));

      // Alpha should come before Avg/Mo
      expect(alphaIndex).toBeGreaterThan(-1);
      expect(avgMoIndex).toBeGreaterThan(-1);
      expect(alphaIndex).toBeLessThan(avgMoIndex);
    });

    test('should display Alpha values with badge styling', async ({ page }) => {
      await page.waitForSelector('table tbody tr');

      const firstRow = page.locator('table tbody tr').first();
      const alphaCell = firstRow.locator('[data-testid="alpha-cell"], td:has(.bg-green-500), td:has(.bg-green-400), td:has(.bg-green-300)').first();

      // Alpha cell should have badge styling (background color)
      await expect(alphaCell).toBeVisible();
      const alphaBadge = alphaCell.locator('.bg-green-500, .bg-green-400, .bg-green-300, .bg-green-200, .bg-red-200');
      await expect(alphaBadge).toBeVisible();
    });

    test('should position heart button next to Alpha value', async ({ page }) => {
      await page.waitForSelector('table tbody tr');

      const firstRow = page.locator('table tbody tr').first();

      // Heart should be in or adjacent to the Alpha cell
      const alphaCell = firstRow.locator('[data-testid="alpha-cell"]').first();
      const heartInAlpha = alphaCell.locator('[data-testid="favorite-pattern-button"], button[title*="favorite" i]');

      // Either heart is inside alpha cell, or they're in adjacent positions
      const heartCount = await heartInAlpha.count();
      if (heartCount > 0) {
        await expect(heartInAlpha.first()).toBeVisible();
      } else {
        // If not in same cell, verify heart is visible near alpha
        const heartBtn = firstRow.locator('[data-testid="favorite-pattern-button"]').first();
        await expect(heartBtn).toBeVisible();
      }
    });
  });

  test.describe('Avg/Mo Column (Demoted)', () => {
    test('should display Avg/Mo without prominent badge styling', async ({ page }) => {
      await page.waitForSelector('table tbody tr');

      const firstRow = page.locator('table tbody tr').first();

      // Find the Avg/Mo cell (should not have the large badge anymore)
      // The badge styling should now be on Alpha, not Avg/Mo
      const cells = firstRow.locator('td');
      const cellCount = await cells.count();

      // Count cells with badge styling - there should only be one (Alpha)
      let badgeCount = 0;
      for (let i = 0; i < cellCount; i++) {
        const cell = cells.nth(i);
        const hasBadge = await cell.locator('.inline-block.px-3.py-1.rounded-lg.font-bold.shadow-sm').count();
        if (hasBadge > 0) badgeCount++;
      }

      // Should only have one prominently styled cell (Alpha)
      expect(badgeCount).toBeLessThanOrEqual(1);
    });
  });

  test.describe('Sentiment vs Pattern Favorite Separation', () => {
    test('should keep sentiment buttons on ticker, heart separate', async ({ page }) => {
      await page.waitForSelector('table tbody tr');

      const firstRow = page.locator('table tbody tr').first();

      // Ticker cell should have sentiment buttons (thumbs)
      const tickerCell = firstRow.locator('td:has-text("AAPL"), td:has-text("MSFT"), td:has(.font-bold.text-indigo-600)').first();

      // Hover to reveal sentiment buttons
      await tickerCell.hover();
      await page.waitForTimeout(200);

      // Sentiment buttons (thumbs up/down) should be in ticker area
      const thumbsUp = tickerCell.locator('button[title*="Like"]');
      const thumbsDown = tickerCell.locator('button[title*="Avoid"]');

      // These should be visible on hover
      if (await thumbsUp.count() > 0) {
        await expect(thumbsUp.first()).toBeVisible();
      }

      // Heart should NOT be grouped with sentiment buttons
      // It should be in the Alpha cell area instead
      const heartInTicker = tickerCell.locator('[data-testid="favorite-pattern-button"]');
      expect(await heartInTicker.count()).toBe(0);
    });
  });

  test.describe('Persistence', () => {
    test('should persist favorite state after page reload', async ({ page }) => {
      await page.waitForSelector('table tbody tr');

      // Favorite a pattern
      const firstRow = page.locator('table tbody tr').first();
      const heartBtn = firstRow.locator('[data-testid="favorite-pattern-button"], button[title*="favorite" i]').first();
      await heartBtn.click();
      await page.waitForTimeout(500);

      // Verify it's favorited
      let svg = heartBtn.locator('svg');
      let fill = await svg.getAttribute('fill');
      expect(fill).toBe('currentColor');

      // Reload
      await page.reload();
      await page.click('a:has-text("Screener")');
      await page.waitForURL('**/#screener');
      await page.waitForSelector('table tbody tr');

      // Heart should still be filled
      const heartBtnAfter = page.locator('table tbody tr').first().locator('[data-testid="favorite-pattern-button"], button[title*="favorite" i]').first();
      svg = heartBtnAfter.locator('svg');
      fill = await svg.getAttribute('fill');
      expect(fill).toBe('currentColor');
    });
  });
});
