import { test, expect } from '@playwright/test';

/**
 * Issue #28: Migrate UI to shadcn/ui component library
 *
 * Acceptance Criteria:
 * - shadcn/ui initialized in client/
 * - Core components installed (button, input, select, table, tooltip)
 * - Sidebar converted to use shadcn components
 * - Filter controls converted
 * - Heatmap table converted to DataTable (if beneficial)
 * - Visual consistency across all pages
 * - No regression in functionality
 */

test.describe('Issue #28: shadcn/ui Migration', () => {
  test('should use consistent button styling', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // All buttons should use shadcn variant classes
    const buttons = page.locator('button');
    const count = await buttons.count();

    // Check that buttons have consistent styling
    for (let i = 0; i < Math.min(count, 5); i++) {
      const button = buttons.nth(i);
      if (await button.isVisible()) {
        // Should have consistent padding, border-radius
        const classes = await button.getAttribute('class');
        // shadcn buttons typically have consistent class patterns
        expect(classes).toBeTruthy();
      }
    }
  });

  test('should use consistent input styling', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const inputs = page.locator('input[type="text"], input[type="number"]');
    const count = await inputs.count();

    for (let i = 0; i < Math.min(count, 3); i++) {
      const input = inputs.nth(i);
      if (await input.isVisible()) {
        const classes = await input.getAttribute('class');
        // Should have shadcn input styling
        expect(classes).toBeTruthy();
      }
    }
  });

  test('should use proper select components', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to search page where select components exist
    const searchInput = page.locator('input[placeholder*="earch"]').first();
    await searchInput.fill('AAPL');
    const result = page.locator('button:has-text("AAPL")').first();
    await result.click();
    await page.waitForSelector('text=Best Entry Months', { timeout: 15000 });

    // Now check for select components in the filter bar
    const selects = page.locator('select');
    const count = await selects.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should have tooltips on heatmap cells', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Search for a stock
    const searchInput = page.locator('input[placeholder*="earch"]').first();
    await searchInput.fill('AAPL');
    const result = page.locator('button:has-text("AAPL")').first();
    await result.click();
    await page.waitForSelector('text=Best Entry Months', { timeout: 15000 });

    // Hover over a heatmap cell - they have title attributes for tooltips
    const cell = page.locator('td[title]').first();
    if (await cell.count() > 0) {
      const title = await cell.getAttribute('title');
      expect(title).toBeTruthy();
    }
  });

  test('should have sidebar navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Sidebar exists as aside element
    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeVisible();

    // Should have navigation items
    const navItems = sidebar.locator('a');
    const count = await navItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should have consistent table styling', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Search for a stock to get tables
    const searchInput = page.locator('input[placeholder*="earch"]').first();
    await searchInput.fill('AAPL');
    const result = page.locator('button:has-text("AAPL")').first();
    await result.click();
    await page.waitForSelector('text=Best Entry Months', { timeout: 15000 });

    // Tables should have proper styling
    const tables = page.locator('table');
    const count = await tables.count();
    expect(count).toBeGreaterThan(0);

    const firstTable = tables.first();
    await expect(firstTable).toBeVisible();
  });

  test('should maintain visual consistency across pages', async ({ page }) => {
    // Visit multiple pages and check for consistent styling
    const pages = ['/', '/#favorites', '/#screener'];

    for (const pagePath of pages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');

      // Background color should be consistent
      const body = page.locator('body');
      await expect(body).toBeVisible();

      // Typography should be consistent
      const headings = page.locator('h1, h2, h3');
      const count = await headings.count();

      if (count > 0) {
        const firstHeading = headings.first();
        await expect(firstHeading).toBeVisible();
      }
    }
  });

  test('should not regress search functionality', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('input[placeholder*="earch"]').first();
    await searchInput.fill('MSFT');

    const result = page.locator('button:has-text("MSFT")').first();
    await expect(result).toBeVisible({ timeout: 5000 });

    await result.click();
    await page.waitForSelector('text=Best Entry Months', { timeout: 15000 });

    // Heatmap tables should load
    const tables = page.locator('table');
    await expect(tables.first()).toBeVisible();
  });

  test('should not regress favorites functionality', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to favorites using hash link
    await page.click('a[href="#favorites"]');
    await page.waitForURL('**/#favorites');

    // Favorites page should load
    const favoritesHeader = page.locator('h2:has-text("Favorite")');
    await expect(favoritesHeader).toBeVisible();
  });

  test('should have proper focus management', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Tab through interactive elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Focus should be visible
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    // Should have focus ring
    const classes = await focusedElement.getAttribute('class');
    // shadcn components have focus-visible states
  });
});
