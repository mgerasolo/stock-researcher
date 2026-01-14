import { test, expect } from '@playwright/test';

/**
 * Issue #12: Calendar view for favorited patterns
 *
 * Tests for the Favorites page with both list view and calendar view
 * to see patterns organized by entry month.
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

// Helper function to add a favorite from the Best Entry Months panel
async function addFavorite(page: any) {
  const unfilledStar = page.locator('button:has-text("☆")').first();
  await unfilledStar.click();
  await page.waitForTimeout(300);
}

test.describe('Calendar View for Favorites', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('Favorites page is accessible from navigation', async ({ page }) => {
    // Look for favorites link in navigation
    const favoritesNav = page.locator('a:has-text("Favorites")');
    await favoritesNav.click();

    // Wait for navigation
    await page.waitForURL('**/#favorites');

    // Should see the favorites page header
    const header = page.locator('h2:has-text("Favorite Patterns")');
    await expect(header).toBeVisible();
  });

  test('empty favorites shows helpful message', async ({ page }) => {
    // Navigate to favorites
    await page.click('a:has-text("Favorites")');
    await page.waitForURL('**/#favorites');

    // Should see "No favorites" message
    const emptyMessage = page.locator('text=No favorites yet');
    await expect(emptyMessage).toBeVisible();
  });

  test('favorites page shows patterns after adding favorites', async ({ page }) => {
    // First add some favorites
    await searchStock(page, 'AAPL');
    await addFavorite(page);
    await addFavorite(page);

    // Navigate to favorites page
    await page.click('a:has-text("Favorites")');
    await page.waitForURL('**/#favorites');
    await page.waitForTimeout(1000);

    // Should see a table with pattern data
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // Should show AAPL ticker
    const appleRow = page.locator('text=AAPL');
    await expect(appleRow.first()).toBeVisible();
  });

  test('calendar view toggle exists when favorites present', async ({ page }) => {
    // Add a favorite first
    await searchStock(page, 'AAPL');
    await addFavorite(page);

    // Navigate to favorites
    await page.click('a:has-text("Favorites")');
    await page.waitForURL('**/#favorites');
    await page.waitForTimeout(500);

    // Find the Calendar view toggle button
    const calendarButton = page.locator('button:has-text("Calendar")');
    await expect(calendarButton).toBeVisible();

    // Click to switch to calendar view
    await calendarButton.click();
    await page.waitForTimeout(300);

    // Should now see month labels (Jan, Feb, Mar, etc.)
    const januarySection = page.locator('text=Jan').first();
    await expect(januarySection).toBeVisible();
  });

  test('calendar view shows all 12 months', async ({ page }) => {
    // Add a favorite first
    await searchStock(page, 'AAPL');
    await addFavorite(page);

    // Navigate to favorites and switch to calendar
    await page.click('a:has-text("Favorites")');
    await page.waitForURL('**/#favorites');
    await page.click('button:has-text("Calendar")');
    await page.waitForTimeout(500);

    // Check for all 12 month cards
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (const month of months) {
      const monthCard = page.locator(`text="${month}"`).first();
      await expect(monthCard).toBeVisible();
    }
  });

  test('list view toggle returns to table view', async ({ page }) => {
    // Add a favorite first
    await searchStock(page, 'AAPL');
    await addFavorite(page);

    // Navigate to favorites
    await page.click('a:has-text("Favorites")');
    await page.waitForURL('**/#favorites');

    // Switch to calendar view first
    await page.click('button:has-text("Calendar")');
    await page.waitForTimeout(300);

    // Now switch back to list view
    await page.click('button:has-text("List")');
    await page.waitForTimeout(300);

    // Should see the table again
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });

  test('sort options work in list view', async ({ page }) => {
    // Add multiple favorites
    await searchStock(page, 'AAPL');
    await addFavorite(page);
    await addFavorite(page);
    await addFavorite(page);

    // Navigate to favorites
    await page.click('a:has-text("Favorites")');
    await page.waitForURL('**/#favorites');
    await page.waitForTimeout(500);

    // Find sort dropdown
    const sortSelect = page.locator('select').first();
    await expect(sortSelect).toBeVisible();

    // Change sort option
    await sortSelect.selectOption({ label: 'Sort by Win %' });

    // Table should still be visible (sorting applied)
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });

  test('favorites page shows count in header', async ({ page }) => {
    // Add favorites
    await searchStock(page, 'AAPL');
    await addFavorite(page);
    await addFavorite(page);

    // Navigate to favorites
    await page.click('a:has-text("Favorites")');
    await page.waitForURL('**/#favorites');

    // Header should show count of saved patterns
    const countText = page.locator('text=/2\\s*saved\\s*pattern/');
    await expect(countText).toBeVisible();
  });
});
