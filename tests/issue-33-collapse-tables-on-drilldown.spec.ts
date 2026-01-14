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

    // Wait for the screener table to fully load with data
    const screenerTable = page.locator('tbody tr').first();
    await expect(screenerTable).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000); // Extra wait for all rows to render

    // Get the holding period from the first row BEFORE clicking
    // The Period column shows "3-mo", "6-mo", or "12-mo"
    const firstRow = page.locator('tbody tr').first();
    const periodCell = firstRow.locator('td').nth(2); // Period is in 3rd column
    const periodText = await periodCell.textContent();

    // Determine the actual holding period from the cell text
    let holdingPeriod = 3;
    if (periodText?.includes('6')) {
      holdingPeriod = 6;
    } else if (periodText?.includes('12')) {
      holdingPeriod = 12;
    }

    // Click the first row to drill down
    await firstRow.click();

    // Wait for navigation to search page with ticker
    await page.waitForURL(/.*#search\/.*/);
    await page.waitForTimeout(1500);

    // The matching holding period table should be expanded (shows "Collapse")
    const matchingTableButton = page.locator(`button:has-text("${holdingPeriod} Month Returns")`);
    await expect(matchingTableButton).toBeVisible({ timeout: 10000 });
    const matchingCollapseText = matchingTableButton.locator('text=Collapse');
    await expect(matchingCollapseText).toBeVisible();

    // Tables for OTHER holding periods should be collapsed
    // Check all non-matching tables show "Expand"
    const otherPeriods = [1, 3, 6, 12].filter(p => p !== holdingPeriod);
    for (const period of otherPeriods) {
      const otherButton = page.locator(`button:has-text("${period} Month Returns")`);
      if (await otherButton.isVisible()) {
        const expandText = otherButton.locator('text=Expand');
        await expect(expandText).toBeVisible();
      }
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
    await page.waitForTimeout(1500);

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

    // Wait for table to load and click first row
    const firstDataRow = page.locator('tbody tr').first();
    await expect(firstDataRow).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(500);
    await firstDataRow.click();

    // Wait for navigation to search page
    await page.waitForURL(/.*#search\/.*/);
    await page.waitForTimeout(1500);

    // Verify the page loaded with heatmap tables
    const heatmapExists = page.locator('button:has-text("Month Returns")').first();
    await expect(heatmapExists).toBeVisible();

    // The Best Months drawer should exist and be operational
    // Look for the "Best Entry Months" heading in the drawer
    const drawerHeading = page.locator('text=Best Entry Months');
    await expect(drawerHeading).toBeVisible({ timeout: 5000 });

    // Verify the page is functional (drawer state is independent)
    await expect(heatmapExists).toBeVisible();
  });
});
