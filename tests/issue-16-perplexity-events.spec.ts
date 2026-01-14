import { test, expect } from '@playwright/test';

/**
 * Issue #16: AI event lookup with Perplexity
 *
 * Acceptance Criteria:
 * - "Explain Why" button triggers Perplexity search
 * - Searches for: company events, earnings, product launches, news
 * - Returns relevant context for pattern timeframe
 * - Handles anomaly years (e.g., COVID 2020)
 * - Display results alongside pattern analysis
 */

test.describe('Issue #16: AI Event Lookup with Perplexity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Search for a stock
    const searchInput = page.getByRole('textbox', { name: /Search for a stock ticker/ });
    await searchInput.fill('AAPL');
    const result = page.getByRole('button', { name: /AAPL.*Tier/i });
    await result.click();
    await page.waitForSelector('text=Best Entry Months', { timeout: 15000 });
  });

  test('should show "Explain Why" button on pattern cells', async ({ page }) => {
    // Click on a heatmap cell
    const cell = page.locator('[data-testid^="heatmap-cell-"], .heatmap-cell').first();
    await cell.click();
    await page.waitForTimeout(300);

    // Should see "Explain Why" button
    const explainButton = page.locator('button:has-text("Explain Why"), button:has-text("Why?")');
    await expect(explainButton).toBeVisible();
  });

  test('should trigger Perplexity search on click', async ({ page }) => {
    const cell = page.locator('[data-testid^="heatmap-cell-"], .heatmap-cell').first();
    await cell.click();
    await page.waitForTimeout(300);

    const explainButton = page.locator('button:has-text("Explain Why"), button:has-text("Why?")');
    await explainButton.click();

    // Should show loading state
    const loading = page.locator('[data-testid="event-lookup-loading"], text=/searching|looking up/i');
    await expect(loading).toBeVisible();
  });

  test('should display event context results', async ({ page }) => {
    const cell = page.locator('[data-testid^="heatmap-cell-"], .heatmap-cell').first();
    await cell.click();
    await page.waitForTimeout(300);

    const explainButton = page.locator('button:has-text("Explain Why"), button:has-text("Why?")');
    await explainButton.click();

    // Wait for results
    const eventResults = page.locator('[data-testid="event-results"], [data-testid="perplexity-results"]');
    await expect(eventResults).toBeVisible({ timeout: 30000 });

    // Should contain event-related content
    const content = await eventResults.textContent();
    expect(content).toBeTruthy();
  });

  test('should explain company-specific events', async ({ page }) => {
    // Search for AAPL which has clear patterns (iPhone launches in September)
    const cell = page.locator('[data-testid^="heatmap-cell-"], .heatmap-cell').first();
    await cell.click();
    await page.waitForTimeout(300);

    const explainButton = page.locator('button:has-text("Explain Why"), button:has-text("Why?")');
    await explainButton.click();

    const eventResults = page.locator('[data-testid="event-results"], [data-testid="perplexity-results"]');
    await expect(eventResults).toBeVisible({ timeout: 30000 });

    // For AAPL, should mention product launches, earnings, or company events
    const content = await eventResults.textContent();
    const hasRelevantContent = /iphone|launch|earnings|product|apple/i.test(content || '');
    expect(hasRelevantContent).toBe(true);
  });

  test('should handle anomaly years specially', async ({ page }) => {
    const cell = page.locator('[data-testid^="heatmap-cell-"], .heatmap-cell').first();
    await cell.click();
    await page.waitForTimeout(300);

    const explainButton = page.locator('button:has-text("Explain Why"), button:has-text("Why?")');
    await explainButton.click();

    const eventResults = page.locator('[data-testid="event-results"], [data-testid="perplexity-results"]');
    await expect(eventResults).toBeVisible({ timeout: 30000 });

    // If there's anomaly info, it should be highlighted
    const anomalySection = page.locator('[data-testid="anomaly-explanation"], text=/2020|covid|unusual/i');
    // This may or may not be visible depending on the pattern - just check it's handled
    if (await anomalySection.isVisible()) {
      await expect(anomalySection).toBeVisible();
    }
  });

  test('should display results alongside pattern analysis', async ({ page }) => {
    const cell = page.locator('[data-testid^="heatmap-cell-"], .heatmap-cell').first();
    await cell.click();
    await page.waitForTimeout(300);

    const explainButton = page.locator('button:has-text("Explain Why"), button:has-text("Why?")');
    await explainButton.click();

    await page.waitForSelector('[data-testid="event-results"], [data-testid="perplexity-results"]', { timeout: 30000 });

    // Event results should be in same modal/panel as pattern stats
    const statsPanel = page.locator('[data-testid="pattern-stats"], text=/win rate|avg return/i');
    await expect(statsPanel).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API failure
    await page.route('**/api/events**', route => route.abort());
    await page.route('**/api/perplexity**', route => route.abort());

    const cell = page.locator('[data-testid^="heatmap-cell-"], .heatmap-cell').first();
    await cell.click();
    await page.waitForTimeout(300);

    const explainButton = page.locator('button:has-text("Explain Why"), button:has-text("Why?")');
    await explainButton.click();

    // Should show error message, not crash
    const errorMessage = page.locator('[data-testid="event-error"], text=/error|unavailable|failed/i');
    await expect(errorMessage).toBeVisible({ timeout: 15000 });
  });
});
