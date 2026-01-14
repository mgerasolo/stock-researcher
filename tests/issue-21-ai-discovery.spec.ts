import { test, expect } from '@playwright/test';

/**
 * Issue #21: AI-powered pattern discovery across all stocks
 *
 * Acceptance Criteria:
 * - User specifies criteria (timeframe, min win rate, etc.)
 * - System scans all stocks in database
 * - AI ranks and filters results
 * - Returns top N opportunities with explanations
 * - Handles large dataset efficiently
 */

test.describe('Issue #21: AI-Powered Pattern Discovery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should have AI discovery feature accessible', async ({ page }) => {
    // Look for AI Discovery or similar feature
    const discoveryLink = page.locator('a:has-text("Discover"), a:has-text("AI Scan"), button:has-text("Find Patterns")');
    await expect(discoveryLink).toBeVisible();
  });

  test('should show criteria input form', async ({ page }) => {
    // Navigate to discovery
    const discoveryLink = page.locator('a:has-text("Discover"), a:has-text("AI Scan"), button:has-text("Find Patterns")');
    await discoveryLink.click();
    await page.waitForTimeout(500);

    // Should have criteria inputs
    const timeframeInput = page.locator('[data-testid="timeframe-input"], input[name*="timeframe"], select[name*="timeframe"]');
    const winRateInput = page.locator('[data-testid="min-win-rate"], input[name*="win"], input[placeholder*="win"]');

    await expect(timeframeInput).toBeVisible();
    await expect(winRateInput).toBeVisible();
  });

  test('should accept user-defined criteria', async ({ page }) => {
    const discoveryLink = page.locator('a:has-text("Discover"), a:has-text("AI Scan"), button:has-text("Find Patterns")');
    await discoveryLink.click();
    await page.waitForTimeout(500);

    // Set criteria
    const timeframeInput = page.locator('[data-testid="timeframe-input"], input[name*="timeframe"], select[name*="timeframe"]');
    const winRateInput = page.locator('[data-testid="min-win-rate"], input[name*="win"]');

    await timeframeInput.fill('30');
    await winRateInput.fill('70');

    // Verify values accepted
    expect(await timeframeInput.inputValue()).toBe('30');
    expect(await winRateInput.inputValue()).toBe('70');
  });

  test('should trigger full market scan', async ({ page }) => {
    const discoveryLink = page.locator('a:has-text("Discover"), a:has-text("AI Scan"), button:has-text("Find Patterns")');
    await discoveryLink.click();
    await page.waitForTimeout(500);

    // Set criteria
    const winRateInput = page.locator('[data-testid="min-win-rate"], input[name*="win"]');
    await winRateInput.fill('65');

    // Click scan button
    const scanButton = page.locator('button:has-text("Scan"), button:has-text("Find"), button:has-text("Discover")');
    await scanButton.click();

    // Should show scanning progress
    const progress = page.locator('[data-testid="scan-progress"], text=/scanning|analyzing/i');
    await expect(progress).toBeVisible({ timeout: 5000 });
  });

  test('should return top N opportunities', async ({ page }) => {
    const discoveryLink = page.locator('a:has-text("Discover"), a:has-text("AI Scan"), button:has-text("Find Patterns")');
    await discoveryLink.click();
    await page.waitForTimeout(500);

    const winRateInput = page.locator('[data-testid="min-win-rate"], input[name*="win"]');
    await winRateInput.fill('60');

    const scanButton = page.locator('button:has-text("Scan"), button:has-text("Find"), button:has-text("Discover")');
    await scanButton.click();

    // Wait for results (may take a while)
    const results = page.locator('[data-testid="discovery-results"], [data-testid="top-patterns"]');
    await expect(results).toBeVisible({ timeout: 120000 });

    // Should have multiple results
    const resultItems = page.locator('[data-testid="discovery-result-item"], .pattern-card');
    const count = await resultItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should include AI explanations with results', async ({ page }) => {
    const discoveryLink = page.locator('a:has-text("Discover"), a:has-text("AI Scan"), button:has-text("Find Patterns")');
    await discoveryLink.click();
    await page.waitForTimeout(500);

    const winRateInput = page.locator('[data-testid="min-win-rate"], input[name*="win"]');
    await winRateInput.fill('60');

    const scanButton = page.locator('button:has-text("Scan"), button:has-text("Find"), button:has-text("Discover")');
    await scanButton.click();

    await page.waitForSelector('[data-testid="discovery-results"]', { timeout: 120000 });

    // First result should have explanation
    const firstResult = page.locator('[data-testid="discovery-result-item"], .pattern-card').first();
    const explanation = firstResult.locator('[data-testid="ai-explanation"], text=/why|because|confidence/i');
    await expect(explanation).toBeVisible();
  });

  test('should allow specifying result count', async ({ page }) => {
    const discoveryLink = page.locator('a:has-text("Discover"), a:has-text("AI Scan"), button:has-text("Find Patterns")');
    await discoveryLink.click();
    await page.waitForTimeout(500);

    // Look for top N selector
    const topNInput = page.locator('[data-testid="top-n-input"], input[name*="top"], select[name*="results"]');
    await expect(topNInput).toBeVisible();

    // Set to 5
    await topNInput.fill('5');

    const scanButton = page.locator('button:has-text("Scan"), button:has-text("Find"), button:has-text("Discover")');
    await scanButton.click();

    await page.waitForSelector('[data-testid="discovery-results"]', { timeout: 120000 });

    // Should return 5 results
    const resultItems = page.locator('[data-testid="discovery-result-item"], .pattern-card');
    const count = await resultItems.count();
    expect(count).toBeLessThanOrEqual(5);
  });

  test('should handle large dataset efficiently', async ({ page }) => {
    const discoveryLink = page.locator('a:has-text("Discover"), a:has-text("AI Scan"), button:has-text("Find Patterns")');
    await discoveryLink.click();
    await page.waitForTimeout(500);

    // Use loose criteria to scan more stocks
    const winRateInput = page.locator('[data-testid="min-win-rate"], input[name*="win"]');
    await winRateInput.fill('50');

    const startTime = Date.now();

    const scanButton = page.locator('button:has-text("Scan"), button:has-text("Find"), button:has-text("Discover")');
    await scanButton.click();

    await page.waitForSelector('[data-testid="discovery-results"]', { timeout: 180000 });

    const duration = (Date.now() - startTime) / 1000;

    // Should complete within 3 minutes even with full database
    expect(duration).toBeLessThan(180);
  });
});
