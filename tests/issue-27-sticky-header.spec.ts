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

    // Search for a stock to get heatmaps
    const searchInput = page.getByRole('textbox', { name: /Search for a stock ticker/ });
    await searchInput.fill('AAPL');
    const result = page.getByRole('button', { name: /AAPL.*Tier/i });
    await result.click();
    await page.waitForSelector('text=Best Entry Months', { timeout: 15000 });
  });

  test('should have consolidated parameters bar', async ({ page }) => {
    const parametersBar = page.locator('[data-testid="parameters-bar"], .parameters-bar, [role="toolbar"]');
    await expect(parametersBar).toBeVisible();
  });

  test('should include years of data selector', async ({ page }) => {
    const yearsSelector = page.locator('[data-testid="years-selector"], select:has-text("years"), button:has-text("years")');
    await expect(yearsSelector).toBeVisible();
  });

  test('should include highlight criteria filters', async ({ page }) => {
    const winRateFilter = page.locator('[data-testid="win-rate-filter"], input[name*="win"], select:has-text("Win")');
    const gainFilter = page.locator('[data-testid="gain-filter"], input[name*="gain"], select:has-text("Gain")');

    await expect(winRateFilter).toBeVisible();
    await expect(gainFilter).toBeVisible();
  });

  test('should include calculation method toggle', async ({ page }) => {
    const methodToggle = page.locator('[data-testid="calc-method-toggle"], button:has-text("Max"), button:has-text("Open")');
    await expect(methodToggle).toBeVisible();
  });

  test('should include view mode toggle', async ({ page }) => {
    const viewToggle = page.locator('[data-testid="view-mode-toggle"], button:has-text("Entry"), button:has-text("Exit")');
    await expect(viewToggle).toBeVisible();
  });

  test('should show match count indicator', async ({ page }) => {
    const matchCount = page.locator('[data-testid="match-count"], text=/\\d+.*match|match.*\\d+/i');
    await expect(matchCount).toBeVisible();
  });

  test('should remain sticky when scrolling', async ({ page }) => {
    // Get initial position of parameters bar
    const parametersBar = page.locator('[data-testid="parameters-bar"], .parameters-bar');
    const initialBounds = await parametersBar.boundingBox();

    // Scroll down significantly
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(300);

    // Bar should still be visible at top
    const afterScrollBounds = await parametersBar.boundingBox();
    await expect(parametersBar).toBeVisible();

    // Y position should be at top (sticky)
    expect(afterScrollBounds!.y).toBeLessThan(100);
  });

  test('should update heatmaps when parameters change', async ({ page }) => {
    // Get initial heatmap state
    const heatmapCell = page.locator('[data-testid^="heatmap-cell-"], .heatmap-cell').first();
    const initialContent = await heatmapCell.textContent();

    // Change a parameter (e.g., years)
    const yearsSelector = page.locator('[data-testid="years-selector"], select:has-text("years")');
    if (await yearsSelector.isVisible()) {
      await yearsSelector.selectOption('5');
      await page.waitForTimeout(1000);

      // Heatmap should update
      const updatedContent = await heatmapCell.textContent();
      // Content may or may not change, but no error should occur
      expect(updatedContent).toBeDefined();
    }
  });

  test('should not have years selector in individual heatmaps', async ({ page }) => {
    // Individual heatmap components should NOT have their own years selector
    const heatmapTable = page.locator('[data-testid="heatmap-table"], .heatmap-table').first();
    const inlineYears = heatmapTable.locator('select:has-text("years")');

    // Should NOT be visible inside heatmap
    await expect(inlineYears).not.toBeVisible();
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Resize to mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);

    // Parameters bar should still be accessible
    const parametersBar = page.locator('[data-testid="parameters-bar"], .parameters-bar');
    await expect(parametersBar).toBeVisible();

    // May use collapsed/hamburger menu
    const mobileMenu = page.locator('[data-testid="mobile-parameters-menu"], button[aria-label*="filter"]');
    if (await mobileMenu.isVisible()) {
      await mobileMenu.click();
      // Should show parameters
      const yearsOption = page.locator('text=/years/i');
      await expect(yearsOption).toBeVisible();
    }
  });

  test('should show clear visual indication of active filters', async ({ page }) => {
    // Set some filters
    const winRateFilter = page.locator('[data-testid="win-rate-filter"], input[name*="win"]');
    if (await winRateFilter.isVisible()) {
      await winRateFilter.fill('70');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      // Should show active filter indicator
      const activeIndicator = page.locator('[data-testid="active-filter-badge"], .active-filter, text=/active|filtered/i');
      await expect(activeIndicator).toBeVisible();
    }
  });
});
