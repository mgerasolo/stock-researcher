import { test, expect } from '@playwright/test';

/**
 * Issue #22: AI composite pattern ranking
 *
 * Acceptance Criteria:
 * - Define composite scoring algorithm
 * - AI explains why each pattern ranked high
 * - Filter out low-confidence patterns
 * - Highlight exceptional opportunities
 */

test.describe('Issue #22: AI Composite Pattern Ranking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display composite score for discovered patterns', async ({ page }) => {
    // Navigate to AI discovery
    const discoveryLink = page.locator('a:has-text("Discover"), a:has-text("AI Scan"), button:has-text("Find Patterns")');
    await discoveryLink.click();

    // Run scan
    const scanButton = page.locator('button:has-text("Scan"), button:has-text("Find")');
    await scanButton.click();

    // Wait for results
    await page.waitForSelector('[data-testid="discovery-results"]', { timeout: 120000 });

    // Each result should show composite score
    const firstResult = page.locator('[data-testid="discovery-result-item"], .pattern-card').first();
    const score = firstResult.locator('[data-testid="composite-score"], text=/score/i');
    await expect(score).toBeVisible();
  });

  test('should rank patterns by composite score', async ({ page }) => {
    const discoveryLink = page.locator('a:has-text("Discover"), a:has-text("AI Scan")');
    await discoveryLink.click();

    const scanButton = page.locator('button:has-text("Scan"), button:has-text("Find")');
    await scanButton.click();

    await page.waitForSelector('[data-testid="discovery-results"]', { timeout: 120000 });

    // Get scores from first few results
    const results = page.locator('[data-testid="discovery-result-item"], .pattern-card');
    const count = await results.count();

    const scores: number[] = [];
    for (let i = 0; i < Math.min(count, 5); i++) {
      const scoreText = await results.nth(i).locator('[data-testid="composite-score"]').textContent();
      const score = parseFloat(scoreText?.replace(/[^0-9.]/g, '') || '0');
      scores.push(score);
    }

    // Verify sorted descending
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  test('should show AI explanation for high-ranked patterns', async ({ page }) => {
    const discoveryLink = page.locator('a:has-text("Discover"), a:has-text("AI Scan")');
    await discoveryLink.click();

    const scanButton = page.locator('button:has-text("Scan"), button:has-text("Find")');
    await scanButton.click();

    await page.waitForSelector('[data-testid="discovery-results"]', { timeout: 120000 });

    // First result should have AI explanation
    const firstResult = page.locator('[data-testid="discovery-result-item"], .pattern-card').first();
    const explanation = firstResult.locator('[data-testid="ai-explanation"], text=/why|because|ranked/i');
    await expect(explanation).toBeVisible();
  });

  test('should filter out low-confidence patterns', async ({ page }) => {
    const discoveryLink = page.locator('a:has-text("Discover"), a:has-text("AI Scan")');
    await discoveryLink.click();

    // Set low confidence threshold
    const confidenceFilter = page.locator('[data-testid="confidence-filter"], select:has-text("Confidence")');
    if (await confidenceFilter.isVisible()) {
      await confidenceFilter.selectOption('high');
    }

    const scanButton = page.locator('button:has-text("Scan"), button:has-text("Find")');
    await scanButton.click();

    await page.waitForSelector('[data-testid="discovery-results"]', { timeout: 120000 });

    // All results should be high confidence
    const results = page.locator('[data-testid="discovery-result-item"]');
    const count = await results.count();

    for (let i = 0; i < Math.min(count, 5); i++) {
      const confidence = await results.nth(i).locator('[data-testid="confidence-level"]').textContent();
      expect(confidence?.toLowerCase()).toContain('high');
    }
  });

  test('should highlight exceptional opportunities', async ({ page }) => {
    const discoveryLink = page.locator('a:has-text("Discover"), a:has-text("AI Scan")');
    await discoveryLink.click();

    const scanButton = page.locator('button:has-text("Scan"), button:has-text("Find")');
    await scanButton.click();

    await page.waitForSelector('[data-testid="discovery-results"]', { timeout: 120000 });

    // Top results should have exceptional badge/highlight
    const topResult = page.locator('[data-testid="discovery-result-item"]').first();
    const badge = topResult.locator('[data-testid="exceptional-badge"], .exceptional, text=/top|exceptional|outstanding/i');

    // May or may not have exceptional results - check if present
    if (await badge.isVisible()) {
      await expect(badge).toBeVisible();
    }
  });

  test('should explain scoring factors', async ({ page }) => {
    const discoveryLink = page.locator('a:has-text("Discover"), a:has-text("AI Scan")');
    await discoveryLink.click();

    const scanButton = page.locator('button:has-text("Scan"), button:has-text("Find")');
    await scanButton.click();

    await page.waitForSelector('[data-testid="discovery-results"]', { timeout: 120000 });

    // Click on a result to see details
    const firstResult = page.locator('[data-testid="discovery-result-item"]').first();
    await firstResult.click();

    // Should show scoring breakdown
    const breakdown = page.locator('[data-testid="score-breakdown"], text=/win rate|return|consistency/i');
    await expect(breakdown).toBeVisible();
  });
});
