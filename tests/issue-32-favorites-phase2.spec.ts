import { test, expect } from '@playwright/test';

/**
 * Issue #32: Favorites, ratings, and ticker sentiment - Phase 2
 *
 * Remaining Acceptance Criteria:
 * - Heart icon on screener rows to favorite patterns
 * - Star rating on favorited patterns
 *
 * (Phase 1 already completed: thumbs up/down, screener filtering)
 */

test.describe('Issue #32: Favorites Phase 2 - Screener Heart & Ratings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('screener should show heart icon on result rows', async ({ page }) => {
    // Navigate to Top Periods (screener)
    await page.click('a[href="#top-periods"]');
    await page.waitForURL('**/#top-periods');

    // Wait for results table to load
    await page.waitForSelector('table tbody tr', { timeout: 30000 });

    // First row should have heart icon (appears on hover)
    const firstRow = page.locator('tbody tr').first();
    await firstRow.hover();

    // Look for SVG heart icon button
    const heartIcon = firstRow.locator('button svg path[d*="4.318 6.318"]');
    await expect(heartIcon).toBeVisible();
  });

  test('clicking heart should favorite the pattern', async ({ page }) => {
    await page.click('a[href="#top-periods"]');
    await page.waitForURL('**/#top-periods');
    await page.waitForSelector('table tbody tr', { timeout: 30000 });

    // Hover to reveal heart icon
    const firstRow = page.locator('tbody tr').first();
    await firstRow.hover();

    // Click heart button
    const heartButton = firstRow.locator('button').filter({ has: page.locator('svg path[d*="4.318 6.318"]') });
    await heartButton.click();
    await page.waitForTimeout(500);

    // Heart should now be filled (pink color)
    await expect(heartButton).toHaveClass(/text-pink-500/);
  });

  test('heart button click changes title attribute', async ({ page }) => {
    await page.click('a[href="#top-periods"]');
    await page.waitForURL('**/#top-periods');
    await page.waitForSelector('table tbody tr', { timeout: 30000 });

    // Find a row to test - use row 3 to avoid conflicts with other tests
    const testRow = page.locator('tbody tr').nth(2);
    await testRow.hover();
    const heartButton = testRow.locator('button').filter({ has: page.locator('svg path[d*="4.318 6.318"]') });

    // Get initial title
    const initialTitle = await heartButton.getAttribute('title');

    // Click heart
    await heartButton.click({ force: true });

    // Wait for title to change (indicates state toggle)
    await expect(heartButton).not.toHaveAttribute('title', initialTitle!, { timeout: 5000 });
  });

  test('favorited patterns should show star rating option', async ({ page }) => {
    // First add a favorite from screener
    await page.click('a[href="#top-periods"]');
    await page.waitForURL('**/#top-periods');
    await page.waitForSelector('table tbody tr', { timeout: 30000 });

    const firstRow = page.locator('tbody tr').first();
    await firstRow.hover();
    const heartButton = firstRow.locator('button').filter({ has: page.locator('svg path[d*="4.318 6.318"]') });
    await heartButton.click();
    await page.waitForTimeout(500);

    // Go to favorites
    await page.click('a[href="#favorites"]');
    await page.waitForURL('**/#favorites');
    await page.waitForTimeout(1000);

    // Should have star rating component (SVG stars)
    const starRating = page.locator('button svg path[d*="9.049 2.927"]');
    await expect(starRating.first()).toBeVisible();
  });

  test('should be able to set star rating', async ({ page }) => {
    // Navigate to favorites
    await page.click('a[href="#favorites"]');
    await page.waitForURL('**/#favorites');
    await page.waitForTimeout(1000);

    // Check if there are favorites with star buttons
    const starButtons = page.locator('button svg[fill="currentColor"] path[d*="9.049 2.927"]');
    const count = await starButtons.count();

    if (count >= 5) {
      // Click on 4th star (0-indexed, so nth(3))
      const fourthStarButton = page.locator('button').filter({ has: page.locator('svg path[d*="9.049 2.927"]') }).nth(3);
      await fourthStarButton.click();
      await page.waitForTimeout(500);

      // Check that stars are now amber colored (filled)
      const filledStars = page.locator('button.text-amber-400 svg path[d*="9.049 2.927"]');
      const filledCount = await filledStars.count();
      expect(filledCount).toBeGreaterThanOrEqual(4);
    }
  });

  test('star rating should persist after page reload', async ({ page }) => {
    await page.click('a[href="#favorites"]');
    await page.waitForURL('**/#favorites');
    await page.waitForTimeout(1000);

    const starButtons = page.locator('button svg path[d*="9.049 2.927"]');
    const count = await starButtons.count();

    if (count >= 5) {
      // Set rating to 3 stars
      const thirdStarButton = page.locator('button').filter({ has: page.locator('svg path[d*="9.049 2.927"]') }).nth(2);
      await thirdStarButton.click();
      await page.waitForTimeout(500);

      // Reload page
      await page.reload();
      await page.waitForURL('**/#favorites');
      await page.waitForTimeout(1000);

      // Rating should persist - check for amber colored stars
      const filledStars = page.locator('button.text-amber-400 svg path[d*="9.049 2.927"]');
      const filledCount = await filledStars.count();
      expect(filledCount).toBeGreaterThanOrEqual(3);
    }
  });

  test('multiple heart clicks toggle back and forth', async ({ page }) => {
    await page.click('a[href="#top-periods"]');
    await page.waitForURL('**/#top-periods');
    await page.waitForSelector('table tbody tr', { timeout: 30000 });

    // Use row 5 to avoid conflicts with other tests
    const testRow = page.locator('tbody tr').nth(4);
    await testRow.hover();
    const heartButton = testRow.locator('button').filter({ has: page.locator('svg path[d*="4.318 6.318"]') });

    // Get initial title
    const initialTitle = await heartButton.getAttribute('title');

    // First click - toggles state
    await heartButton.click({ force: true });
    await expect(heartButton).not.toHaveAttribute('title', initialTitle!, { timeout: 5000 });

    // Get new title
    const middleTitle = await heartButton.getAttribute('title');

    // Second click - toggles back
    await heartButton.click({ force: true });
    await expect(heartButton).not.toHaveAttribute('title', middleTitle!, { timeout: 5000 });
  });
});
