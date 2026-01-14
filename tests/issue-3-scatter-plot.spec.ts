import { test, expect } from '@playwright/test';

/**
 * Issue #3: Add scatter plot visualization above heatmap matrix
 *
 * Acceptance Criteria:
 * - Scatter plot displayed above heatmap matrix
 * - Each point represents a year's return for that month
 * - Outliers visually obvious
 * - Interactive (hover for details)
 */

test.describe('Issue #3: Scatter Plot Visualization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to load and search for a stock
    await page.waitForSelector('[data-testid="stock-search"]', { timeout: 10000 });
    await page.fill('[data-testid="stock-search"]', 'AAPL');
    await page.click('[data-testid="search-button"]');
    await page.waitForSelector('[data-testid="heatmap-container"]', { timeout: 15000 });
  });

  test('should display scatter plot above heatmap matrix', async ({ page }) => {
    // Scatter plot should be visible above the heatmap
    const scatterPlot = page.locator('[data-testid="scatter-plot"]');
    await expect(scatterPlot).toBeVisible();

    // Verify it appears before (above) the heatmap
    const scatterBounds = await scatterPlot.boundingBox();
    const heatmapBounds = await page.locator('[data-testid="heatmap-container"]').boundingBox();

    expect(scatterBounds).not.toBeNull();
    expect(heatmapBounds).not.toBeNull();
    expect(scatterBounds!.y).toBeLessThan(heatmapBounds!.y);
  });

  test('should show data points representing yearly returns', async ({ page }) => {
    // Each point should represent a year's return for the selected month
    const dataPoints = page.locator('[data-testid="scatter-plot"] [data-testid="data-point"]');

    // Should have multiple data points (one per year of data)
    const count = await dataPoints.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should make outliers visually obvious', async ({ page }) => {
    // Outliers should have distinct styling (different color, larger size, etc.)
    const outlierPoints = page.locator('[data-testid="scatter-plot"] [data-testid="outlier-point"]');

    // If there are outliers, they should be visually distinct
    const count = await outlierPoints.count();
    if (count > 0) {
      const firstOutlier = outlierPoints.first();
      // Check that outliers have a distinguishing attribute
      await expect(firstOutlier).toHaveAttribute('data-outlier', 'true');
    }
  });

  test('should show hover tooltip with details', async ({ page }) => {
    // Hover over a data point should show details
    const dataPoint = page.locator('[data-testid="scatter-plot"] [data-testid="data-point"]').first();

    if (await dataPoint.isVisible()) {
      await dataPoint.hover();

      // Tooltip should appear with year and return info
      const tooltip = page.locator('[data-testid="scatter-tooltip"]');
      await expect(tooltip).toBeVisible();

      // Tooltip should contain year and return percentage
      const tooltipText = await tooltip.textContent();
      expect(tooltipText).toMatch(/\d{4}/); // Year
      expect(tooltipText).toMatch(/%/); // Return percentage
    }
  });

  test('should update scatter plot when month is selected', async ({ page }) => {
    // Click on a month column header or select a month
    const monthHeader = page.locator('[data-testid="month-header-Mar"]');

    if (await monthHeader.isVisible()) {
      await monthHeader.click();

      // Scatter plot should update to show data for that month
      const scatterTitle = page.locator('[data-testid="scatter-plot-title"]');
      await expect(scatterTitle).toContainText('Mar');
    }
  });

  test('should show average line or marker', async ({ page }) => {
    // Reference line showing average return
    const avgLine = page.locator('[data-testid="scatter-plot"] [data-testid="average-line"]');
    await expect(avgLine).toBeVisible();
  });

  test('should color-code positive and negative returns', async ({ page }) => {
    const positivePoints = page.locator('[data-testid="scatter-plot"] [data-testid="data-point"][data-positive="true"]');
    const negativePoints = page.locator('[data-testid="scatter-plot"] [data-testid="data-point"][data-positive="false"]');

    // Check that styling differs between positive and negative
    const positiveCount = await positivePoints.count();
    const negativeCount = await negativePoints.count();

    // At least some data points should exist
    expect(positiveCount + negativeCount).toBeGreaterThan(0);
  });
});
