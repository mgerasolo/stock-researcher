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
    // Navigate to screener
    await page.click('a:has-text("Screener")');
    await page.waitForURL('**/#screener');

    // Run a search
    await page.click('[data-testid="screener-search-button"], button:has-text("Search"), button:has-text("Scan")');
    await page.waitForSelector('[data-testid="screener-results"], table', { timeout: 30000 });

    // First row should have heart icon
    const firstRow = page.locator('[data-testid="screener-result-row"], tbody tr').first();
    const heartIcon = firstRow.locator('[data-testid="favorite-heart"], button:has-text("♡"), button:has-text("❤")');
    await expect(heartIcon).toBeVisible();
  });

  test('clicking heart should favorite the pattern', async ({ page }) => {
    await page.click('a:has-text("Screener")');
    await page.waitForURL('**/#screener');

    await page.click('[data-testid="screener-search-button"], button:has-text("Search")');
    await page.waitForSelector('[data-testid="screener-results"]', { timeout: 30000 });

    // Click heart on first row
    const firstRow = page.locator('[data-testid="screener-result-row"], tbody tr').first();
    const heartIcon = firstRow.locator('[data-testid="favorite-heart"], button:has-text("♡")');
    await heartIcon.click();

    // Heart should change to filled state
    const filledHeart = firstRow.locator('[data-testid="favorite-heart-filled"], button:has-text("❤")');
    await expect(filledHeart).toBeVisible();
  });

  test('favorited pattern should appear in favorites page', async ({ page }) => {
    await page.click('a:has-text("Screener")');
    await page.waitForURL('**/#screener');

    await page.click('[data-testid="screener-search-button"], button:has-text("Search")');
    await page.waitForSelector('[data-testid="screener-results"]', { timeout: 30000 });

    // Get ticker from first row
    const firstRow = page.locator('[data-testid="screener-result-row"], tbody tr').first();
    const ticker = await firstRow.locator('[data-testid="cell-ticker"], td:first-child').textContent();

    // Click heart to favorite
    const heartIcon = firstRow.locator('[data-testid="favorite-heart"], button:has-text("♡")');
    await heartIcon.click();
    await page.waitForTimeout(500);

    // Navigate to favorites
    await page.click('a:has-text("Favorites")');
    await page.waitForURL('**/#favorites');
    await page.waitForTimeout(1000);

    // Pattern should be in favorites
    const favoritedPattern = page.locator(`text=${ticker}`);
    await expect(favoritedPattern.first()).toBeVisible();
  });

  test('favorited patterns should show star rating option', async ({ page }) => {
    // First add a favorite from screener
    await page.click('a:has-text("Screener")');
    await page.waitForURL('**/#screener');

    await page.click('[data-testid="screener-search-button"], button:has-text("Search")');
    await page.waitForSelector('[data-testid="screener-results"]', { timeout: 30000 });

    const heartIcon = page.locator('[data-testid="favorite-heart"], button:has-text("♡")').first();
    await heartIcon.click();
    await page.waitForTimeout(500);

    // Go to favorites
    await page.click('a:has-text("Favorites")');
    await page.waitForURL('**/#favorites');
    await page.waitForTimeout(1000);

    // Should have star rating component
    const starRating = page.locator('[data-testid="star-rating"], .star-rating');
    await expect(starRating).toBeVisible();
  });

  test('should be able to set star rating', async ({ page }) => {
    // Navigate to favorites (assuming there are some)
    await page.click('a:has-text("Favorites")');
    await page.waitForURL('**/#favorites');

    const starRating = page.locator('[data-testid="star-rating"], .star-rating').first();

    if (await starRating.isVisible()) {
      // Click on 4th star
      const fourthStar = starRating.locator('button, span').nth(3);
      await fourthStar.click();

      // Should now show 4 filled stars
      const filledStars = starRating.locator('[data-filled="true"], .filled');
      const count = await filledStars.count();
      expect(count).toBe(4);
    }
  });

  test('star rating should persist after page reload', async ({ page }) => {
    await page.click('a:has-text("Favorites")');
    await page.waitForURL('**/#favorites');

    const starRating = page.locator('[data-testid="star-rating"], .star-rating').first();

    if (await starRating.isVisible()) {
      // Set rating
      const thirdStar = starRating.locator('button, span').nth(2);
      await thirdStar.click();
      await page.waitForTimeout(500);

      // Reload page
      await page.reload();
      await page.waitForURL('**/#favorites');
      await page.waitForTimeout(500);

      // Rating should persist
      const filledStars = starRating.locator('[data-filled="true"], .filled');
      const count = await filledStars.count();
      expect(count).toBe(3);
    }
  });

  test('clicking filled heart should unfavorite', async ({ page }) => {
    await page.click('a:has-text("Screener")');
    await page.waitForURL('**/#screener');

    await page.click('[data-testid="screener-search-button"], button:has-text("Search")');
    await page.waitForSelector('[data-testid="screener-results"]', { timeout: 30000 });

    // Favorite first
    const firstRow = page.locator('[data-testid="screener-result-row"], tbody tr').first();
    const heartIcon = firstRow.locator('[data-testid="favorite-heart"]');
    await heartIcon.click();
    await page.waitForTimeout(300);

    // Click again to unfavorite
    await heartIcon.click();
    await page.waitForTimeout(300);

    // Should be unfilled again
    const unfilledHeart = firstRow.locator('[data-testid="favorite-heart"]:has-text("♡")');
    await expect(unfilledHeart).toBeVisible();
  });
});
