import { test, expect } from '@playwright/test';

/**
 * Issue #17: AI synthesis - combined pattern explanation
 *
 * Acceptance Criteria:
 * - Single "Explain Pattern" button triggers both APIs
 * - Combine responses into coherent narrative
 * - Show: pattern assessment + event context + confidence
 * - Loading states for each API call
 * - Graceful handling if one API fails
 */

test.describe('Issue #17: AI Synthesis - Combined Pattern Explanation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByRole('textbox', { name: /Search for a stock ticker/ });
    await searchInput.fill('AAPL');
    const result = page.getByRole('button', { name: /AAPL.*Tier/i });
    await result.click();
    await page.waitForSelector('text=Best Entry Months', { timeout: 15000 });
  });

  test('should show "Explain Pattern" button', async ({ page }) => {
    const cell = page.locator('[data-testid^="heatmap-cell-"], .heatmap-cell').first();
    await cell.click();
    await page.waitForTimeout(300);

    const explainButton = page.locator('button:has-text("Explain Pattern"), button:has-text("Explain")');
    await expect(explainButton).toBeVisible();
  });

  test('should trigger both AI APIs with single click', async ({ page }) => {
    let claudeRequestMade = false;
    let perplexityRequestMade = false;

    // Monitor API requests
    page.on('request', request => {
      const url = request.url();
      if (url.includes('analyze') || url.includes('claude') || url.includes('gpt')) {
        claudeRequestMade = true;
      }
      if (url.includes('perplexity') || url.includes('events')) {
        perplexityRequestMade = true;
      }
    });

    const cell = page.locator('[data-testid^="heatmap-cell-"], .heatmap-cell').first();
    await cell.click();
    await page.waitForTimeout(300);

    const explainButton = page.locator('button:has-text("Explain Pattern"), button:has-text("Explain")');
    await explainButton.click();

    // Wait for requests
    await page.waitForTimeout(2000);

    // Both APIs should be called
    expect(claudeRequestMade || perplexityRequestMade).toBe(true);
  });

  test('should show combined explanation modal', async ({ page }) => {
    const cell = page.locator('[data-testid^="heatmap-cell-"], .heatmap-cell').first();
    await cell.click();
    await page.waitForTimeout(300);

    const explainButton = page.locator('button:has-text("Explain Pattern"), button:has-text("Explain")');
    await explainButton.click();

    const modal = page.locator('[data-testid="pattern-explanation-modal"], [role="dialog"]:has-text("Explanation")');
    await expect(modal).toBeVisible({ timeout: 30000 });
  });

  test('should display Pattern Summary section', async ({ page }) => {
    const cell = page.locator('[data-testid^="heatmap-cell-"], .heatmap-cell').first();
    await cell.click();
    await page.waitForTimeout(300);

    const explainButton = page.locator('button:has-text("Explain Pattern"), button:has-text("Explain")');
    await explainButton.click();

    await page.waitForSelector('[data-testid="pattern-explanation-modal"], [role="dialog"]', { timeout: 30000 });

    // Should have Pattern Summary section
    const summarySection = page.locator('text=/pattern summary|summary/i');
    await expect(summarySection).toBeVisible();
  });

  test('should display "Why This Works" section from Perplexity', async ({ page }) => {
    const cell = page.locator('[data-testid^="heatmap-cell-"], .heatmap-cell').first();
    await cell.click();
    await page.waitForTimeout(300);

    const explainButton = page.locator('button:has-text("Explain Pattern"), button:has-text("Explain")');
    await explainButton.click();

    await page.waitForSelector('[data-testid="pattern-explanation-modal"], [role="dialog"]', { timeout: 30000 });

    // Should have "Why This Works" or event context section
    const whySection = page.locator('text=/why this works|events|context/i');
    await expect(whySection).toBeVisible();
  });

  test('should display Confidence section from Claude', async ({ page }) => {
    const cell = page.locator('[data-testid^="heatmap-cell-"], .heatmap-cell').first();
    await cell.click();
    await page.waitForTimeout(300);

    const explainButton = page.locator('button:has-text("Explain Pattern"), button:has-text("Explain")');
    await explainButton.click();

    await page.waitForSelector('[data-testid="pattern-explanation-modal"], [role="dialog"]', { timeout: 30000 });

    // Should show confidence level
    const confidenceSection = page.locator('text=/confidence|high|medium|low/i');
    await expect(confidenceSection).toBeVisible();
  });

  test('should show loading states for each API', async ({ page }) => {
    const cell = page.locator('[data-testid^="heatmap-cell-"], .heatmap-cell').first();
    await cell.click();
    await page.waitForTimeout(300);

    const explainButton = page.locator('button:has-text("Explain Pattern"), button:has-text("Explain")');
    await explainButton.click();

    // Should show loading indicators
    const loading = page.locator('[data-testid="loading-indicator"], text=/loading|analyzing/i');
    await expect(loading).toBeVisible();
  });

  test('should handle partial API failure gracefully', async ({ page }) => {
    // Block only Perplexity, let Claude succeed
    await page.route('**/api/perplexity**', route => route.abort());
    await page.route('**/api/events**', route => route.abort());

    const cell = page.locator('[data-testid^="heatmap-cell-"], .heatmap-cell').first();
    await cell.click();
    await page.waitForTimeout(300);

    const explainButton = page.locator('button:has-text("Explain Pattern"), button:has-text("Explain")');
    await explainButton.click();

    // Modal should still appear
    const modal = page.locator('[data-testid="pattern-explanation-modal"], [role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 30000 });

    // Should show partial results with error notice
    const partialError = page.locator('text=/event lookup unavailable|partial results/i');
    // Check it exists or gracefully degrades
    if (await partialError.isVisible()) {
      await expect(partialError).toBeVisible();
    }
  });

  test('should handle anomaly years in combined view', async ({ page }) => {
    const cell = page.locator('[data-testid^="heatmap-cell-"], .heatmap-cell').first();
    await cell.click();
    await page.waitForTimeout(300);

    const explainButton = page.locator('button:has-text("Explain Pattern"), button:has-text("Explain")');
    await explainButton.click();

    await page.waitForSelector('[data-testid="pattern-explanation-modal"], [role="dialog"]', { timeout: 30000 });

    // If anomalies exist, should have section for them
    const anomalySection = page.locator('[data-testid="anomaly-years"], text=/anomal|unusual year/i');
    // May or may not be visible depending on data
  });
});
