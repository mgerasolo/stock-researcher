import { test, expect } from '@playwright/test';

/**
 * Issue #19: Custom holding periods
 *
 * Acceptance Criteria:
 * - Input field for custom period (e.g., 4 months, 8 months)
 * - Backend calculates returns for any period
 * - Heatmap displays custom period data
 * - Screener supports custom period filter
 */

test.describe('Issue #19: Custom Holding Periods', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByRole('textbox', { name: /Search for a stock ticker/ });
    await searchInput.fill('AAPL');
    const result = page.getByRole('button', { name: /AAPL.*Tier/i });
    await result.click();
    await page.waitForSelector('text=Best Entry Months', { timeout: 15000 });
  });

  test('should show custom period input field', async ({ page }) => {
    // Look for custom period input or "Custom" option
    const customInput = page.locator('[data-testid="custom-period-input"], input[placeholder*="custom"], button:has-text("Custom")');
    await expect(customInput).toBeVisible();
  });

  test('should accept custom period value', async ({ page }) => {
    // If there's a custom button, click it first
    const customBtn = page.locator('button:has-text("Custom")');
    if (await customBtn.isVisible()) {
      await customBtn.click();
    }

    // Enter custom period
    const customInput = page.locator('[data-testid="custom-period-input"], input[type="number"][name*="period"]');
    await customInput.fill('4');
    await page.keyboard.press('Enter');

    await page.waitForTimeout(1000);

    // Heatmap should update to show 4-month returns
    const periodIndicator = page.locator('text=/4.*month|4M/i');
    await expect(periodIndicator).toBeVisible();
  });

  test('should calculate returns for custom period', async ({ page }) => {
    // Set custom 4-month period
    const customBtn = page.locator('button:has-text("Custom")');
    if (await customBtn.isVisible()) {
      await customBtn.click();
    }

    const customInput = page.locator('[data-testid="custom-period-input"], input[type="number"]');
    await customInput.fill('4');
    await page.keyboard.press('Enter');

    await page.waitForTimeout(1500);

    // Heatmap cells should have data
    const cells = page.locator('[data-testid^="heatmap-cell-"], .heatmap-cell');
    const count = await cells.count();
    expect(count).toBeGreaterThan(0);

    // First cell should have a return value
    const firstCell = cells.first();
    const cellText = await firstCell.textContent();
    expect(cellText).toMatch(/[+-]?\d+\.?\d*%?/);
  });

  test('should display custom period in heatmap header', async ({ page }) => {
    const customBtn = page.locator('button:has-text("Custom")');
    if (await customBtn.isVisible()) {
      await customBtn.click();
    }

    const customInput = page.locator('[data-testid="custom-period-input"], input[type="number"]');
    await customInput.fill('8');
    await page.keyboard.press('Enter');

    await page.waitForTimeout(1000);

    // Header should show "8-Month Returns" or similar
    const header = page.locator('text=/8.*month|8M holding/i');
    await expect(header).toBeVisible();
  });

  test('screener should support custom period filter', async ({ page }) => {
    // Navigate to screener
    await page.click('a:has-text("Screener")');
    await page.waitForURL('**/#screener');

    // Find period filter
    const periodFilter = page.locator('[data-testid="period-filter"], select:has(option:has-text("month"))');

    if (await periodFilter.isVisible()) {
      // Look for custom option or input
      const customOption = page.locator('option:has-text("Custom"), [data-testid="custom-period-option"]');
      const hasCustom = await customOption.count() > 0;

      // Or look for input field
      const customInput = page.locator('[data-testid="custom-period-input"]');
      const hasCustomInput = await customInput.isVisible();

      expect(hasCustom || hasCustomInput).toBe(true);
    }
  });

  test('should validate custom period range', async ({ page }) => {
    const customBtn = page.locator('button:has-text("Custom")');
    if (await customBtn.isVisible()) {
      await customBtn.click();
    }

    const customInput = page.locator('[data-testid="custom-period-input"], input[type="number"]');

    // Try invalid value (too large)
    await customInput.fill('24');
    await page.keyboard.press('Enter');

    // Should show error or clamp value
    const error = page.locator('[data-testid="period-error"], text=/invalid|maximum/i');
    const inputValue = await customInput.inputValue();

    // Either show error or clamp to max (e.g., 12)
    if (await error.isVisible()) {
      await expect(error).toBeVisible();
    } else {
      expect(parseInt(inputValue)).toBeLessThanOrEqual(12);
    }
  });

  test('should persist custom period selection', async ({ page }) => {
    const customBtn = page.locator('button:has-text("Custom")');
    if (await customBtn.isVisible()) {
      await customBtn.click();
    }

    const customInput = page.locator('[data-testid="custom-period-input"], input[type="number"]');
    await customInput.fill('5');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Search for different stock
    const searchInput = page.getByRole('textbox', { name: /Search for a stock ticker/ });
    await searchInput.fill('MSFT');
    const result = page.getByRole('button', { name: /MSFT.*Tier/i });
    await result.click();
    await page.waitForSelector('text=Best Entry Months', { timeout: 15000 });

    // Period should still be 5 months
    const periodIndicator = page.locator('text=/5.*month|5M/i');
    await expect(periodIndicator).toBeVisible();
  });
});
