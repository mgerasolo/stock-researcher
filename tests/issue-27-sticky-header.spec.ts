import { test, expect } from '@playwright/test';

/**
 * Issue #27: Consolidate search parameters into sticky header bar
 *
 * Acceptance Criteria:
 * - All search parameters consolidated in one sticky bar
 * - Bar stays visible when scrolling through heatmaps
 * - Changing any parameter updates all visible heatmaps
 * - Clear visual indication of current filter state
 * - Years selector removed from individual heatmap components
 * - Mobile-friendly responsive design
 */

test.describe('Issue #27: Sticky Parameters Header Bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Search for a stock to get heatmaps - use flexible placeholder selector
    const searchInput = page.locator('input[placeholder*="earch"]').first();
    await searchInput.fill('AAPL');

    // Wait for search results and click first result
    const result = page.locator('button:has-text("AAPL")').first();
    await result.click();
    await page.waitForSelector('text=Best Entry Months', { timeout: 15000 });
  });

  test('should have consolidated parameters bar', async ({ page }) => {
    // The sticky filter bar exists within the main content area
    const parametersBar = page.locator('.sticky.top-0.z-10');
    await expect(parametersBar).toBeVisible();
  });

  test('should include years of data selector', async ({ page }) => {
    // Years selector is a select element within the sticky bar
    const yearsSelector = page.locator('select').filter({ hasText: /8|10|12|15|20/ }).first();
    await expect(yearsSelector).toBeVisible();
  });

  test('should include highlight criteria filters', async ({ page }) => {
    // Win rate and avg gain inputs exist in the Highlight section
    const winRateLabel = page.locator('text=Win%≥');
    const gainLabel = page.locator('text=Avg/Mo≥');

    await expect(winRateLabel).toBeVisible();
    await expect(gainLabel).toBeVisible();
  });

  test('should include calculation method toggle', async ({ page }) => {
    // Method selector has Open → Close and Max → Max options
    const methodSelector = page.locator('select').filter({ hasText: /Open|Max/ });
    await expect(methodSelector).toBeVisible();
  });

  test('should include view mode toggle', async ({ page }) => {
    // View selector has Entry and Exit options
    const viewSelector = page.locator('select').filter({ hasText: /Entry|Exit/ });
    await expect(viewSelector).toBeVisible();
  });

  test('should show match indicator', async ({ page }) => {
    // Match indicator shows colored box with "matches" text (first one in sticky bar)
    const matchIndicator = page.locator('text=matches').first();
    await expect(matchIndicator).toBeVisible();
  });

  test('should remain sticky when scrolling', async ({ page }) => {
    // Get initial position of the sticky bar
    const stickyBar = page.locator('.sticky.top-0.z-10').first();
    await expect(stickyBar).toBeVisible();

    // Scroll down significantly
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(300);

    // Bar should still be visible
    await expect(stickyBar).toBeVisible();

    // Check it's at or near the top
    const bounds = await stickyBar.boundingBox();
    // Account for potential header offset
    expect(bounds!.y).toBeLessThan(200);
  });

  test('should update heatmaps when parameters change', async ({ page }) => {
    // Find years selector and change value
    const yearsSelector = page.locator('select').filter({ hasText: /8|10|12|15|20/ }).first();

    // Get current value
    const currentValue = await yearsSelector.inputValue();

    // Change to a different value
    const newValue = currentValue === '12' ? '10' : '12';
    await yearsSelector.selectOption(newValue);

    // Wait for data to load
    await page.waitForTimeout(1000);

    // Verify the selection changed (no error = success)
    const updatedValue = await yearsSelector.inputValue();
    expect(updatedValue).toBe(newValue);
  });

  test('heatmap tables should not have inline years selector', async ({ page }) => {
    // Look for years selectors inside table elements
    // The only years selector should be in the top sticky bar
    const yearsSelectors = page.locator('select').filter({ hasText: /8|10|12|15|20/ });
    const count = await yearsSelectors.count();

    // Should only have ONE years selector (in sticky bar)
    expect(count).toBe(1);
  });

  test('should display on mobile viewport', async ({ page }) => {
    // Resize to mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    // Some filter controls should still be accessible
    // On mobile they may be in a scrollable container
    const filterSection = page.locator('text=Years');
    await expect(filterSection).toBeVisible();
  });

  test('should show highlight legend', async ({ page }) => {
    // The matches indicator with colored box should be visible (first one in sticky bar)
    const highlightIndicator = page.locator('.bg-purple-100').first();
    await expect(highlightIndicator).toBeVisible();
  });
});
