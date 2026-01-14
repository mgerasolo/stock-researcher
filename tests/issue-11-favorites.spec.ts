import { test, expect } from '@playwright/test';

/**
 * Issue #11: Favorite specific patterns
 *
 * Tests for the ability to star/favorite patterns from the
 * Best Entry Months panel (BestMonthsDrawer).
 */

// Helper function to search for a stock
async function searchStock(page: any, ticker: string) {
  const searchInput = page.getByRole('textbox', { name: /Search for a stock ticker/ });
  await searchInput.fill(ticker);

  const result = page.getByRole('button', { name: new RegExp(`${ticker}.*Tier`, 'i') });
  await result.click();

  // Wait for Best Entry Months panel to load
  await page.waitForSelector('text=Best Entry Months', { timeout: 15000 });
}

test.describe('Favorites System', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('Best Entry Months panel displays star buttons', async ({ page }) => {
    await searchStock(page, 'AAPL');

    // Look for the Best Entry Months panel header
    const panelHeader = page.locator('text=Best Entry Months');
    await expect(panelHeader).toBeVisible();

    // Wait for the table to render
    await page.waitForTimeout(1000);

    // Look for star icons (unfilled stars for non-favorites)
    const starButtons = page.locator('button:has-text("☆")');
    await expect(starButtons.first()).toBeVisible({ timeout: 5000 });
    const count = await starButtons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('clicking star adds pattern to favorites', async ({ page }) => {
    await searchStock(page, 'AAPL');

    // Count initial filled stars
    const initialFilledStars = await page.locator('button:has-text("★")').count();

    // Find an unfilled star and click it
    const unfilledStar = page.locator('button:has-text("☆")').first();
    await unfilledStar.click();

    // Wait for state to update
    await page.waitForTimeout(500);

    // Should now have one more filled star
    const newFilledStars = await page.locator('button:has-text("★")').count();
    expect(newFilledStars).toBeGreaterThan(initialFilledStars);
  });

  test('favorites count updates in panel footer', async ({ page }) => {
    await searchStock(page, 'AAPL');

    // Check initial favorites count (should show "★ 0 favorites")
    const initialFooter = page.locator('text=/★\\s*0\\s*favorite/');
    await expect(initialFooter).toBeVisible();

    // Click a star to add a favorite
    const unfilledStar = page.locator('button:has-text("☆")').first();
    await unfilledStar.click();

    // Favorites count should update (now shows "★ 1 favorite")
    await page.waitForTimeout(500);
    const updatedFooter = page.locator('text=/★\\s*1\\s*favorite/');
    await expect(updatedFooter).toBeVisible();
  });

  test('favorites persist across page reload', async ({ page }) => {
    await searchStock(page, 'AAPL');

    // Add a favorite
    const unfilledStar = page.locator('button:has-text("☆")').first();
    await unfilledStar.click();

    // Wait for localStorage to update and verify
    await page.waitForTimeout(500);

    // Verify it was saved to localStorage
    const savedFavorites = await page.evaluate(() => {
      return localStorage.getItem('stock-researcher-favorites');
    });
    expect(savedFavorites).toBeTruthy();
    expect(JSON.parse(savedFavorites as string).length).toBeGreaterThan(0);

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Search for the same stock again
    await searchStock(page, 'AAPL');

    // Wait for the panel to fully render with favorites
    await page.waitForTimeout(1000);

    // Check that we have at least one filled star
    const filledStars = page.locator('button:has-text("★")');
    const filledCount = await filledStars.count();
    expect(filledCount).toBeGreaterThan(0);
  });

  test('clicking filled star removes from favorites', async ({ page }) => {
    await searchStock(page, 'AAPL');

    // Add a favorite
    const unfilledStar = page.locator('button:has-text("☆")').first();
    await unfilledStar.click();
    await page.waitForTimeout(300);

    // Now click the filled star to remove
    const filledStar = page.locator('button:has-text("★")').first();
    await filledStar.click();
    await page.waitForTimeout(300);

    // Should be back to showing "★ 0 favorites"
    const zeroFavoritesFooter = page.locator('text=/★\\s*0\\s*favorite/');
    await expect(zeroFavoritesFooter).toBeVisible();
  });

  test('multiple patterns can be favorited', async ({ page }) => {
    await searchStock(page, 'AAPL');

    // Add multiple favorites
    const unfilledStars = page.locator('button:has-text("☆")');

    // Click first 3 stars
    for (let i = 0; i < 3; i++) {
      await unfilledStars.first().click();
      await page.waitForTimeout(200);
    }

    // Should show "3 favorites" in footer
    const footer = page.locator('text=/★\\s*3\\s*favorite/');
    await expect(footer).toBeVisible();
  });
});
