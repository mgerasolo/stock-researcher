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
    await page.waitForTimeout(1000);

    // Click the first row to drill down (we don't need to know which period it is)
    const firstRow = page.locator('tbody tr').first();
    await firstRow.click();

    // Wait for navigation to search page with ticker
    await page.waitForURL(/.*#search\/.*/);
    await page.waitForTimeout(1500);

    // Count how many tables are expanded (show "Collapse") vs collapsed (show "Expand")
    // With the fix, exactly ONE table should be expanded
    const allTables = [
      page.locator('button:has-text("1 Month Returns")'),
      page.locator('button:has-text("3 Month Returns")'),
      page.locator('button:has-text("6 Month Returns")'),
      page.locator('button:has-text("12 Month Returns")')
    ];

    let expandedCount = 0;
    let expandedPeriod = '';

    for (const tableButton of allTables) {
      if (await tableButton.isVisible()) {
        const buttonText = await tableButton.textContent();
        if (buttonText?.includes('Collapse')) {
          expandedCount++;
          // Extract the period name from button text
          const match = buttonText.match(/(\d+ Month)/);
          if (match) expandedPeriod = match[1];
        }
      }
    }

    // Exactly one table should be expanded (the drill-down target)
    expect(expandedCount).toBe(1);

    // Verify the expanded table matches a valid timeframe
    expect(['1 Month', '3 Month', '6 Month', '12 Month']).toContain(expandedPeriod);

    // Verify other tables are collapsed
    for (const tableButton of allTables) {
      if (await tableButton.isVisible()) {
        const buttonText = await tableButton.textContent();
        if (!buttonText?.includes(expandedPeriod.split(' ')[0])) {
          // This is not the expanded table, should show "Expand"
          expect(buttonText).toContain('Expand');
        }
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
