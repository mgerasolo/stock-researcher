import { test, expect } from '@playwright/test';

/**
 * Issue #12: Calendar view for favorited patterns
 *
 * Tests for the Favorites page with both list view and calendar view
 * to see patterns organized by entry month.
 */

// Helper function to search for a stock
async function searchStock(page: any, ticker: string) {
  const searchInput = page.locator('input[placeholder*="earch"]').first();
  await searchInput.fill(ticker);

  const result = page.locator(`button:has-text("${ticker}")`).first();
  await result.click();

  // Wait for heatmap to load
  await page.waitForSelector('text=Best Entry Months', { timeout: 15000 });
}

// Helper function to add favorites from the Best Entry Months panel
// Clicks different hearts (by index) to avoid toggling the same one
async function addFavorites(page: any, count: number = 1) {
  // Wait for the heart buttons to appear
  await page.waitForTimeout(500);

  const heartButtons = page.locator('button').filter({
    has: page.locator('svg path[d*="4.318 6.318"]')
  });

  // Click different heart buttons
  for (let i = 0; i < count; i++) {
    const heart = heartButtons.nth(i);
    await heart.click();
    await page.waitForTimeout(500); // Wait for API call
  }
}

// Helper to navigate to favorites page using JavaScript click (bypasses overlay)
async function navigateToFavorites(page: any) {
  // Use JavaScript to click the link directly (bypasses overlay interception)
  await page.evaluate(() => {
    const link = document.querySelector('a[href="#favorites"]') as HTMLElement;
    if (link) link.click();
  });
  await page.waitForURL('**/#favorites');
  // Wait for favorites page header to appear
  await page.waitForSelector('h2:has-text("Favorite Patterns")', { timeout: 10000 });
  // Wait for data loading to complete
  await page.waitForTimeout(2000);
}

test.describe('Calendar View for Favorites', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Favorites page is accessible from navigation', async ({ page }) => {
    // Look for favorites link in navigation
    await page.click('a[href="#favorites"]');
    await page.waitForURL('**/#favorites');

    // Should see the favorites page header
    const header = page.locator('h2:has-text("Favorite Patterns")');
    await expect(header).toBeVisible();
  });

  test('favorites page shows patterns after adding favorites', async ({ page }) => {
    // First add some favorites
    await searchStock(page, 'AAPL');
    await addFavorites(page, 2);

    // Navigate to favorites page using JS click
    await navigateToFavorites(page);

    // Should show AAPL ticker somewhere on the page
    const appleText = page.locator('text=AAPL');
    await expect(appleText.first()).toBeVisible({ timeout: 15000 });
  });

  test('calendar and list view toggles exist when favorites present', async ({ page }) => {
    // Add favorites
    await searchStock(page, 'AAPL');
    await addFavorites(page, 1);

    // Navigate to favorites
    await navigateToFavorites(page);

    // Wait for AAPL to be visible (confirms favorites loaded)
    await page.waitForSelector('text=AAPL', { timeout: 15000 });

    // Find the Calendar and List view toggle buttons
    const calendarButton = page.locator('button:has-text("Calendar")');
    const listButton = page.locator('button:has-text("List")');

    await expect(calendarButton).toBeVisible({ timeout: 5000 });
    await expect(listButton).toBeVisible({ timeout: 5000 });
  });

  test('calendar view shows month grid', async ({ page }) => {
    // Add a favorite
    await searchStock(page, 'AAPL');
    await addFavorites(page, 1);

    // Navigate to favorites
    await navigateToFavorites(page);

    // Wait for content to load
    await page.waitForSelector('text=AAPL', { timeout: 15000 });

    // Click calendar view
    const calendarButton = page.locator('button:has-text("Calendar")');
    await calendarButton.click();
    await page.waitForTimeout(500);

    // Should see at least some month labels
    const janLabel = page.locator('text="Jan"').first();
    const febLabel = page.locator('text="Feb"').first();
    const marLabel = page.locator('text="Mar"').first();

    await expect(janLabel).toBeVisible({ timeout: 5000 });
    await expect(febLabel).toBeVisible({ timeout: 5000 });
    await expect(marLabel).toBeVisible({ timeout: 5000 });
  });

  test('can switch between list and calendar views', async ({ page }) => {
    // Add a favorite
    await searchStock(page, 'AAPL');
    await addFavorites(page, 1);

    // Navigate to favorites
    await navigateToFavorites(page);

    // Wait for content to load
    await page.waitForSelector('text=AAPL', { timeout: 15000 });

    // Default is list view - should see table
    const table = page.locator('table').first();
    await expect(table).toBeVisible({ timeout: 5000 });

    // Switch to calendar view
    await page.click('button:has-text("Calendar")');
    await page.waitForTimeout(500);

    // Should see month labels
    await expect(page.locator('text="Jan"').first()).toBeVisible();

    // Switch back to list view
    await page.click('button:has-text("List")');
    await page.waitForTimeout(500);

    // Should see AAPL in table again
    await expect(page.locator('text=AAPL').first()).toBeVisible();
  });

  test('favorites count shows in header', async ({ page }) => {
    // Add favorites
    await searchStock(page, 'AAPL');
    await addFavorites(page, 2);

    // Navigate to favorites
    await navigateToFavorites(page);

    // Header should show count
    const countText = page.locator('text=/saved\\s*pattern/');
    await expect(countText).toBeVisible({ timeout: 15000 });
  });
});
