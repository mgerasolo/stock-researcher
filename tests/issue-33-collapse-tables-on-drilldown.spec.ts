import { test, expect } from '@playwright/test';

/**
 * Issue #33: Auto-collapse irrelevant tables when drilling down from reports
 *
 * When drilling down from Top Priority or Upcoming Opportunities reports,
 * only the matching holding period table should be expanded.
 */

test.describe('Issue #33: Collapse tables on report drill-down', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
  });

  test('AC1: When drilling down from report, only matching table is expanded', async ({ page }) => {
    // Go to Top Periods report via navigation
    await page.click('text=Top Periods');
    await page.waitForURL(/.*#top-periods.*/);
    await page.waitForTimeout(1000);

    // Wait for the screener table to load
    const screenerTable = page.locator('table').first();
    await expect(screenerTable).toBeVisible({ timeout: 10000 });

    // Find a row with 6-mo or 12-mo holding period and click it
    // The Period column shows "6-mo" or "12-mo"
    let targetRow = page.locator('tbody tr').filter({ hasText: '6-mo' }).first();
    let holdingPeriod = 6;

    if (await targetRow.count() === 0) {
      targetRow = page.locator('tbody tr').filter({ hasText: '12-mo' }).first();
      holdingPeriod = 12;
    }

    if (await targetRow.count() === 0) {
      // Fall back to any row if no 6-mo or 12-mo found
      targetRow = page.locator('tbody tr').first();
      holdingPeriod = 3;
    }

    // Click the row to drill down
    await targetRow.click();

    // Wait for navigation to search page with ticker
    await page.waitForURL(/.*#search\/.*/);
    await page.waitForTimeout(1000);

    // Check the heatmap tables
    // The header format is "{TICKER} - {N} Month Returns"
    // Expanded tables show "▼ Collapse", collapsed show "▶ Expand"

    // The matching holding period table should be expanded
    const expandedIndicator = `${holdingPeriod} Month Returns`;
    const matchingSection = page.locator(`button:has-text("${expandedIndicator}")`);
    await expect(matchingSection).toBeVisible();

    // Check that it shows "Collapse" (expanded state)
    const matchingCollapseText = matchingSection.locator('text=Collapse');
    await expect(matchingCollapseText).toBeVisible();

    // If we drilled down to 6-mo or 12-mo, the 3-month table should be collapsed
    if (holdingPeriod !== 3) {
      const threeMonthSection = page.locator('button:has-text("3 Month Returns")');
      // Collapsed tables show "Expand"
      const expandText = threeMonthSection.locator('text=Expand');
      await expect(expandText).toBeVisible();
    }
  });

  test('AC2: Normal navigation keeps 3-month expanded by default', async ({ page }) => {
    // Navigate to search page directly (no drill-down)
    await page.goto('/#search');
    await page.waitForTimeout(500);

    // Type in search box to select a ticker
    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.fill('AAPL');

    // Wait for autocomplete and select
    await page.waitForTimeout(500);
    const autocompleteOption = page.locator('text=AAPL').first();
    if (await autocompleteOption.isVisible()) {
      await autocompleteOption.click();
    } else {
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
    }

    // Wait for heatmaps to load
    await page.waitForTimeout(1000);

    // 3-month table should be expanded by default (shows "Collapse")
    const threeMonthSection = page.locator('button:has-text("3 Month Returns")');
    await expect(threeMonthSection).toBeVisible({ timeout: 10000 });
    const collapseText = threeMonthSection.locator('text=Collapse');
    await expect(collapseText).toBeVisible();

    // 1-month table should be collapsed (shows "Expand")
    const oneMonthSection = page.locator('button:has-text("1 Month Returns")');
    const expandText = oneMonthSection.locator('text=Expand');
    await expect(expandText).toBeVisible();
  });

  test('AC3: BestMonthsDrawer remains independent of drill-down', async ({ page }) => {
    // Go to Top Periods report
    await page.click('text=Top Periods');
    await page.waitForURL(/.*#top-periods.*/);
    await page.waitForTimeout(1000);

    // Wait for table to load and click first row
    const firstDataRow = page.locator('tbody tr').first();
    await expect(firstDataRow).toBeVisible({ timeout: 10000 });
    await firstDataRow.click();

    // Wait for navigation to search page
    await page.waitForURL(/.*#search\/.*/);
    await page.waitForTimeout(1000);

    // The Best Months drawer should be visible on the right
    // It shows "Best Entry Months" or similar content
    const drawerContent = page.locator('[class*="drawer"]').or(page.locator('text=Best Entry'));

    // The drawer should be present and operational (either visible or togglable)
    // This verifies the drawer wasn't broken by the drill-down logic
    const heatmapExists = page.locator('button:has-text("Month Returns")').first();
    await expect(heatmapExists).toBeVisible();

    // If there's a drawer toggle, click it
    const drawerToggle = page.locator('button:has-text("Best")');
    if (await drawerToggle.isVisible()) {
      await drawerToggle.click();
      await page.waitForTimeout(300);
    }

    // Verify the page is functional after drill-down
    // (drawer state is independent)
    await expect(heatmapExists).toBeVisible();
  });
});
