import { test, expect } from '@playwright/test';

/**
 * Issue #15: AI pattern analysis with Claude/GPT
 *
 * Acceptance Criteria:
 * - "Analyze Pattern" button on heatmap cells
 * - Send pattern stats to Claude/GPT API
 * - AI interprets: win rate significance, risk profile, consistency
 * - Returns confidence assessment (high/medium/low)
 * - Display analysis in UI panel/modal
 */

test.describe('Issue #15: AI Pattern Analysis', () => {
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

  test('should show "Analyze Pattern" button on heatmap cells', async ({ page }) => {
    // Click on a heatmap cell to select it
    const cell = page.locator('[data-testid^="heatmap-cell-"], .heatmap-cell').first();
    await cell.click();
    await page.waitForTimeout(300);

    // Should see an "Analyze" or "AI Analyze" button
    const analyzeButton = page.locator('button:has-text("Analyze"), button:has-text("AI Analysis")');
    await expect(analyzeButton).toBeVisible();
  });

  test('should open analysis modal when clicking analyze button', async ({ page }) => {
    // Click on a cell
    const cell = page.locator('[data-testid^="heatmap-cell-"], .heatmap-cell').first();
    await cell.click();
    await page.waitForTimeout(300);

    // Click analyze button
    const analyzeButton = page.locator('button:has-text("Analyze"), button:has-text("AI Analysis")');
    await analyzeButton.click();

    // Should open a modal or panel
    const analysisModal = page.locator('[data-testid="ai-analysis-modal"], [role="dialog"]:has-text("Analysis")');
    await expect(analysisModal).toBeVisible({ timeout: 10000 });
  });

  test('should display loading state while fetching AI analysis', async ({ page }) => {
    const cell = page.locator('[data-testid^="heatmap-cell-"], .heatmap-cell').first();
    await cell.click();
    await page.waitForTimeout(300);

    const analyzeButton = page.locator('button:has-text("Analyze"), button:has-text("AI Analysis")');
    await analyzeButton.click();

    // Should show loading indicator
    const loadingIndicator = page.locator('[data-testid="analysis-loading"], text=/analyzing|loading/i');
    await expect(loadingIndicator).toBeVisible();
  });

  test('should display AI analysis results', async ({ page }) => {
    const cell = page.locator('[data-testid^="heatmap-cell-"], .heatmap-cell').first();
    await cell.click();
    await page.waitForTimeout(300);

    const analyzeButton = page.locator('button:has-text("Analyze"), button:has-text("AI Analysis")');
    await analyzeButton.click();

    // Wait for analysis to complete
    const analysisContent = page.locator('[data-testid="ai-analysis-content"]');
    await expect(analysisContent).toBeVisible({ timeout: 30000 });

    // Should show pattern reliability assessment
    const reliabilitySection = page.locator('text=/reliability|pattern strength/i');
    await expect(reliabilitySection).toBeVisible();
  });

  test('should show confidence assessment', async ({ page }) => {
    const cell = page.locator('[data-testid^="heatmap-cell-"], .heatmap-cell').first();
    await cell.click();
    await page.waitForTimeout(300);

    const analyzeButton = page.locator('button:has-text("Analyze"), button:has-text("AI Analysis")');
    await analyzeButton.click();

    // Wait for analysis
    await page.waitForSelector('[data-testid="ai-analysis-content"]', { timeout: 30000 });

    // Should display confidence level
    const confidenceLevel = page.locator('[data-testid="confidence-level"], text=/high|medium|low/i');
    await expect(confidenceLevel).toBeVisible();
  });

  test('should display risk/reward analysis', async ({ page }) => {
    const cell = page.locator('[data-testid^="heatmap-cell-"], .heatmap-cell').first();
    await cell.click();
    await page.waitForTimeout(300);

    const analyzeButton = page.locator('button:has-text("Analyze"), button:has-text("AI Analysis")');
    await analyzeButton.click();

    await page.waitForSelector('[data-testid="ai-analysis-content"]', { timeout: 30000 });

    // Should show risk/reward section
    const riskReward = page.locator('text=/risk|reward/i');
    await expect(riskReward).toBeVisible();
  });

  test('should close modal with close button', async ({ page }) => {
    const cell = page.locator('[data-testid^="heatmap-cell-"], .heatmap-cell').first();
    await cell.click();
    await page.waitForTimeout(300);

    const analyzeButton = page.locator('button:has-text("Analyze"), button:has-text("AI Analysis")');
    await analyzeButton.click();

    const analysisModal = page.locator('[data-testid="ai-analysis-modal"], [role="dialog"]:has-text("Analysis")');
    await expect(analysisModal).toBeVisible({ timeout: 10000 });

    // Close the modal
    const closeButton = page.locator('[data-testid="close-analysis-modal"], button:has-text("Close"), [aria-label="Close"]');
    await closeButton.click();

    // Modal should be hidden
    await expect(analysisModal).not.toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API failure by blocking the request
    await page.route('**/api/analyze**', route => route.abort());

    const cell = page.locator('[data-testid^="heatmap-cell-"], .heatmap-cell').first();
    await cell.click();
    await page.waitForTimeout(300);

    const analyzeButton = page.locator('button:has-text("Analyze"), button:has-text("AI Analysis")');
    await analyzeButton.click();

    // Should show error message
    const errorMessage = page.locator('[data-testid="analysis-error"], text=/error|failed|unavailable/i');
    await expect(errorMessage).toBeVisible({ timeout: 15000 });
  });
});
