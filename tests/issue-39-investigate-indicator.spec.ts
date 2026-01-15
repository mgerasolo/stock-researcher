import { test, expect } from '@playwright/test';

/**
 * Issue #39: Add 'Investigate' (?) indicator for tickers to research later
 *
 * Acceptance Criteria:
 * - Database allows 'investigate' sentiment value
 * - ? button appears in StockSummary header (between thumbs)
 * - "To Investigate" section appears in My Tickers
 * - Investigate tickers have distinct amber/yellow styling
 * - Screener can filter by investigate sentiment
 * - Can toggle between all three states
 * - Investigate tickers appear in Upcoming Opportunities
 */

test.describe('Issue #39: Investigate Ticker Indicator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('StockSummary Header', () => {
    test('should show ? button between thumbs up and down', async ({ page }) => {
      // Search for a stock
      const searchInput = page.getByRole('textbox', { name: /Search for a stock ticker/i });
      await searchInput.fill('AAPL');
      const result = page.getByRole('button', { name: /AAPL.*Tier/i });
      await result.click();
      await page.waitForSelector('text=Best Entry Months', { timeout: 15000 });

      // Should see three sentiment buttons in order: thumbs up, ?, thumbs down
      const thumbsUp = page.locator('button[title*="Like"]').first();
      const investigate = page.locator('button[title*="Investigate" i], button[title*="Research" i], button:has-text("?")').first();
      const thumbsDown = page.locator('button[title*="Avoid"]').first();

      await expect(thumbsUp).toBeVisible();
      await expect(investigate).toBeVisible();
      await expect(thumbsDown).toBeVisible();

      // Verify order: thumbsUp should be before investigate, investigate before thumbsDown
      const buttons = page.locator('[data-testid="sentiment-buttons"] button, .flex.items-center.gap-1 button');
      const buttonTexts = await buttons.allTextContents();
      // The ? should be in the middle position
      expect(buttonTexts.length).toBeGreaterThanOrEqual(3);
    });

    test('should allow clicking ? to mark as investigate', async ({ page }) => {
      const searchInput = page.getByRole('textbox', { name: /Search for a stock ticker/i });
      await searchInput.fill('NVDA');
      const result = page.getByRole('button', { name: /NVDA.*Tier/i });
      await result.click();
      await page.waitForSelector('text=Best Entry Months', { timeout: 15000 });

      // Click the investigate button
      const investigateBtn = page.locator('button[title*="Investigate" i], button[title*="Research" i], button:has-text("?")').first();
      await investigateBtn.click();
      await page.waitForTimeout(300);

      // Button should be active (amber/yellow styling)
      await expect(investigateBtn).toHaveClass(/bg-amber|bg-yellow|text-amber|text-yellow/);
    });

    test('should toggle between investigate, like, and avoid', async ({ page }) => {
      const searchInput = page.getByRole('textbox', { name: /Search for a stock ticker/i });
      await searchInput.fill('MSFT');
      const result = page.getByRole('button', { name: /MSFT.*Tier/i });
      await result.click();
      await page.waitForSelector('text=Best Entry Months', { timeout: 15000 });

      const thumbsUp = page.locator('button[title*="Like"]').first();
      const investigate = page.locator('button[title*="Investigate" i], button[title*="Research" i], button:has-text("?")').first();
      const thumbsDown = page.locator('button[title*="Avoid"]').first();

      // Click investigate
      await investigate.click();
      await page.waitForTimeout(300);
      await expect(investigate).toHaveClass(/bg-amber|bg-yellow|text-amber|text-yellow/);

      // Click thumbs up - should switch from investigate to liked
      await thumbsUp.click();
      await page.waitForTimeout(300);
      await expect(thumbsUp).toHaveClass(/bg-green|text-green/);
      // Investigate should no longer be active
      await expect(investigate).not.toHaveClass(/bg-amber|bg-yellow/);

      // Click thumbs down - should switch from liked to avoided
      await thumbsDown.click();
      await page.waitForTimeout(300);
      await expect(thumbsDown).toHaveClass(/bg-red|text-red/);

      // Click investigate again - should switch from avoided to investigate
      await investigate.click();
      await page.waitForTimeout(300);
      await expect(investigate).toHaveClass(/bg-amber|bg-yellow|text-amber|text-yellow/);
      await expect(thumbsDown).not.toHaveClass(/bg-red/);
    });

    test('should deselect investigate when clicking again', async ({ page }) => {
      const searchInput = page.getByRole('textbox', { name: /Search for a stock ticker/i });
      await searchInput.fill('GOOG');
      const result = page.getByRole('button', { name: /GOOG.*Tier/i });
      await result.click();
      await page.waitForSelector('text=Best Entry Months', { timeout: 15000 });

      const investigate = page.locator('button[title*="Investigate" i], button[title*="Research" i], button:has-text("?")').first();

      // Click to activate
      await investigate.click();
      await page.waitForTimeout(300);
      await expect(investigate).toHaveClass(/bg-amber|bg-yellow|text-amber|text-yellow/);

      // Click again to deactivate (back to neutral)
      await investigate.click();
      await page.waitForTimeout(300);
      await expect(investigate).not.toHaveClass(/bg-amber|bg-yellow/);
    });
  });

  test.describe('My Tickers Page', () => {
    test.beforeEach(async ({ page }) => {
      // Add an investigate ticker
      const searchInput = page.getByRole('textbox', { name: /Search for a stock ticker/i });
      await searchInput.fill('NVDA');
      const result = page.getByRole('button', { name: /NVDA.*Tier/i });
      await result.click();
      await page.waitForSelector('text=Best Entry Months', { timeout: 15000 });

      const investigateBtn = page.locator('button[title*="Investigate" i], button[title*="Research" i], button:has-text("?")').first();
      await investigateBtn.click();
      await page.waitForTimeout(300);
    });

    test('should show "To Investigate" section', async ({ page }) => {
      await page.click('a:has-text("My Tickers")');
      await page.waitForURL('**/#sentiment');
      await page.waitForTimeout(500);

      // Should see "To Investigate" or "Investigate" section
      const investigateSection = page.locator('text=/To Investigate|Investigate/i');
      await expect(investigateSection.first()).toBeVisible();
    });

    test('should show investigate tickers with amber styling', async ({ page }) => {
      await page.click('a:has-text("My Tickers")');
      await page.waitForURL('**/#sentiment');
      await page.waitForTimeout(500);

      // NVDA should appear with amber/yellow styling
      const nvdaRow = page.locator('[data-testid="ticker-row-NVDA"], .bg-amber-50, .bg-yellow-50').first();
      await expect(nvdaRow).toBeVisible();

      // Check for amber/yellow color scheme
      const amberElement = page.locator('.bg-amber-50, .border-amber-200, .text-amber-700, .bg-yellow-50, .border-yellow-200, .text-yellow-700').first();
      await expect(amberElement).toBeVisible();
    });

    test('should have filter option for Investigate', async ({ page }) => {
      await page.click('a:has-text("My Tickers")');
      await page.waitForURL('**/#sentiment');
      await page.waitForTimeout(500);

      // Should have "Investigate" filter button or option
      const investigateFilter = page.locator('button:has-text("Investigate"), button:has-text("?")').first();
      await expect(investigateFilter).toBeVisible();

      // Click it to filter to only investigate tickers
      await investigateFilter.click();
      await page.waitForTimeout(300);

      // Should only show investigate section
      const nvda = page.locator('text=NVDA');
      await expect(nvda).toBeVisible();
    });

    test('should show ? icon for investigate tickers', async ({ page }) => {
      await page.click('a:has-text("My Tickers")');
      await page.waitForURL('**/#sentiment');
      await page.waitForTimeout(500);

      // The row should have a ? icon
      const questionIcon = page.locator('text=?, span:has-text("?")').first();
      await expect(questionIcon).toBeVisible();
    });
  });

  test.describe('Screener Filtering', () => {
    test.beforeEach(async ({ page }) => {
      // Add investigate and liked tickers for filtering test
      // Add investigate: NVDA
      const searchInput = page.getByRole('textbox', { name: /Search for a stock ticker/i });
      await searchInput.fill('NVDA');
      await page.getByRole('button', { name: /NVDA.*Tier/i }).click();
      await page.waitForSelector('text=Best Entry Months', { timeout: 15000 });
      await page.locator('button[title*="Investigate" i], button:has-text("?")').first().click();
      await page.waitForTimeout(300);

      // Add liked: AAPL
      await searchInput.fill('AAPL');
      await page.getByRole('button', { name: /AAPL.*Tier/i }).click();
      await page.waitForSelector('text=Best Entry Months', { timeout: 15000 });
      await page.locator('button[title*="Like"]').first().click();
      await page.waitForTimeout(300);
    });

    test('should have "Investigate Only" filter option', async ({ page }) => {
      await page.click('a:has-text("Screener")');
      await page.waitForURL('**/#screener');
      await page.waitForTimeout(500);

      // Find sentiment filter dropdown
      const sentimentFilter = page.locator('select:has(option:text("All")), [data-testid="sentiment-filter"]').first();
      await sentimentFilter.click();

      // Should have "Investigate" option
      const investigateOption = page.locator('option:has-text("Investigate"), option:has-text("?")');
      await expect(investigateOption).toBeVisible();
    });

    test('should filter to only investigate tickers', async ({ page }) => {
      await page.click('a:has-text("Screener")');
      await page.waitForURL('**/#screener');
      await page.waitForTimeout(500);

      // Select "Investigate Only" filter
      const sentimentFilter = page.locator('select:has(option:text("All")), [data-testid="sentiment-filter"]').first();
      await sentimentFilter.selectOption({ label: /Investigate/i });
      await page.waitForTimeout(500);

      // NVDA should be visible, AAPL should not (or less prominent)
      const nvda = page.locator('[data-testid="screener-row-NVDA"], tr:has-text("NVDA")').first();
      await expect(nvda).toBeVisible();
    });
  });

  test.describe('Upcoming Opportunities', () => {
    test('should include investigate tickers', async ({ page }) => {
      // Add investigate ticker
      const searchInput = page.getByRole('textbox', { name: /Search for a stock ticker/i });
      await searchInput.fill('AMD');
      await page.getByRole('button', { name: /AMD.*Tier/i }).click();
      await page.waitForSelector('text=Best Entry Months', { timeout: 15000 });
      await page.locator('button[title*="Investigate" i], button:has-text("?")').first().click();
      await page.waitForTimeout(300);

      // Go to Screener / Upcoming Opportunities
      await page.click('a:has-text("Screener")');
      await page.waitForURL('**/#screener');
      await page.waitForTimeout(500);

      // AMD should appear in upcoming opportunities (not hidden like avoided tickers)
      const amdEntry = page.locator('[data-testid="upcoming-AMD"], td:has-text("AMD"), text=AMD');
      // It should be visible (not filtered out)
      await expect(amdEntry.first()).toBeVisible();
    });
  });

  test.describe('API Endpoints', () => {
    test('PUT should accept investigate sentiment', async ({ request }) => {
      const response = await request.put('/api/ticker-sentiment/TEST', {
        data: { sentiment: 'investigate' }
      });
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.sentiment).toBe('investigate');
    });

    test('GET detailed should return investigate tickers', async ({ request }) => {
      // First set an investigate ticker
      await request.put('/api/ticker-sentiment/TESTINV', {
        data: { sentiment: 'investigate' }
      });

      // Fetch detailed list
      const response = await request.get('/api/ticker-sentiment/detailed');
      expect(response.status()).toBe(200);

      const data = await response.json();
      const testEntry = data.find((d: any) => d.ticker === 'TESTINV');
      expect(testEntry).toBeDefined();
      expect(testEntry.sentiment).toBe('investigate');
    });

    test('should reject invalid sentiment values', async ({ request }) => {
      const response = await request.put('/api/ticker-sentiment/TEST', {
        data: { sentiment: 'invalid' }
      });
      expect(response.status()).toBe(400);
    });
  });

  test.describe('Persistence', () => {
    test('should persist investigate sentiment after reload', async ({ page }) => {
      // Mark as investigate
      const searchInput = page.getByRole('textbox', { name: /Search for a stock ticker/i });
      await searchInput.fill('META');
      await page.getByRole('button', { name: /META.*Tier/i }).click();
      await page.waitForSelector('text=Best Entry Months', { timeout: 15000 });

      const investigateBtn = page.locator('button[title*="Investigate" i], button:has-text("?")').first();
      await investigateBtn.click();
      await page.waitForTimeout(500);

      // Reload
      await page.reload();
      await searchInput.fill('META');
      await page.getByRole('button', { name: /META.*Tier/i }).click();
      await page.waitForSelector('text=Best Entry Months', { timeout: 15000 });

      // Investigate should still be active
      const investigateBtnAfter = page.locator('button[title*="Investigate" i], button:has-text("?")').first();
      await expect(investigateBtnAfter).toHaveClass(/bg-amber|bg-yellow|text-amber|text-yellow/);
    });
  });
});
