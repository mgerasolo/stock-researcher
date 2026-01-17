import { test, expect } from '@playwright/test';

/**
 * Issue #38: Add notes for tickers in My Tickers and stock page
 *
 * Acceptance Criteria:
 * - Database migration adds note column to ticker_sentiment
 * - API can save/retrieve/clear notes for tickers
 * - Note icon appears in My Tickers list next to each item
 * - Note preview shows in My Tickers if note exists (~50 chars)
 * - Expand toggle shows full note and absolute date
 * - Stock page shows notes section for sentiment tickers
 * - Notes persist across sessions
 * - Max 2000 character limit enforced
 */

test.describe('Issue #38: Ticker Notes Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Add a ticker to sentiment (like AAPL) first
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.fill('AAPL');
    const result = page.locator('button:has-text("AAPL")').first();
    await result.click();
    await page.waitForSelector('text=Best Entry Months', { timeout: 15000 });

    // Click thumbs up to add to My Tickers
    const thumbsUpBtn = page.locator('button[title*="Like"]').first();
    if (await thumbsUpBtn.isVisible()) {
      await thumbsUpBtn.click();
      await page.waitForTimeout(300);
    }
  });

  test.describe('My Tickers Page', () => {
    test('should show note edit button next to each ticker', async ({ page }) => {
      // Navigate to My Tickers
      await page.click('a:has-text("My Tickers")');
      await page.waitForURL('**/#my-tickers');
      await page.waitForTimeout(500);

      // Should have a note button for the ticker
      const noteBtn = page.locator('[data-testid="ticker-note-button"], button[title*="note" i], button:has-text("📝")').first();
      await expect(noteBtn).toBeVisible();
    });

    test('should allow adding notes inline', async ({ page }) => {
      await page.click('a:has-text("My Tickers")');
      await page.waitForURL('**/#my-tickers');
      await page.waitForTimeout(500);

      // Click note button to expand inline editor
      const noteBtn = page.locator('[data-testid="ticker-note-button"], button[title*="note" i], button:has-text("📝")').first();
      await noteBtn.click();

      // Should see a text area for note input
      const noteInput = page.locator('[data-testid="ticker-note-input"], textarea[placeholder*="note" i]').first();
      await expect(noteInput).toBeVisible();

      // Type a note
      await noteInput.fill('Strong dividend growth, good for long-term hold');

      // Save the note
      const saveBtn = page.locator('button:has-text("Save")').first();
      await saveBtn.click();
      await page.waitForTimeout(500);

      // Note should be saved and visible as preview
      const savedNote = page.locator('text=Strong dividend growth');
      await expect(savedNote).toBeVisible();
    });

    test('should show note preview truncated to ~50 characters', async ({ page }) => {
      await page.click('a:has-text("My Tickers")');
      await page.waitForURL('**/#my-tickers');
      await page.waitForTimeout(500);

      // Add a long note
      const noteBtn = page.locator('[data-testid="ticker-note-button"], button[title*="note" i], button:has-text("📝")').first();
      await noteBtn.click();

      const noteInput = page.locator('[data-testid="ticker-note-input"], textarea[placeholder*="note" i]').first();
      const longNote = 'This is a very long note that should be truncated in the preview because it exceeds fifty characters significantly';
      await noteInput.fill(longNote);

      const saveBtn = page.locator('button:has-text("Save")').first();
      await saveBtn.click();
      await page.waitForTimeout(500);

      // Should show truncated preview with ellipsis
      const notePreview = page.locator('[data-testid="ticker-note-preview"]').first();
      const previewText = await notePreview.textContent();
      expect(previewText?.length).toBeLessThanOrEqual(60); // ~50 chars + "..."
      expect(previewText).toContain('...');
    });

    test('should expand to show full note and absolute date', async ({ page }) => {
      await page.click('a:has-text("My Tickers")');
      await page.waitForURL('**/#my-tickers');
      await page.waitForTimeout(500);

      // Add a note first
      const noteBtn = page.locator('[data-testid="ticker-note-button"], button[title*="note" i], button:has-text("📝")').first();
      await noteBtn.click();

      const noteInput = page.locator('[data-testid="ticker-note-input"], textarea[placeholder*="note" i]').first();
      await noteInput.fill('Full note content that will be visible when expanded');

      const saveBtn = page.locator('button:has-text("Save")').first();
      await saveBtn.click();
      await page.waitForTimeout(500);

      // Click expand toggle
      const expandToggle = page.locator('[data-testid="ticker-expand-toggle"], button[title*="expand" i], button:has-text("⌄")').first();
      await expandToggle.click();
      await page.waitForTimeout(300);

      // Should show full note
      const fullNote = page.locator('text=Full note content that will be visible when expanded');
      await expect(fullNote).toBeVisible();

      // Should show absolute date (e.g., "Jan 14, 2026" or "Added: Jan 14, 2026")
      const dateElement = page.locator('[data-testid="ticker-date"]').first();
      await expect(dateElement).toBeVisible();
    });

    test('should not show relative dates', async ({ page }) => {
      await page.click('a:has-text("My Tickers")');
      await page.waitForURL('**/#my-tickers');
      await page.waitForTimeout(500);

      // Check that no relative date formats appear
      const relativeDate = page.locator('text=/\\d+[hmd] ago|Just now|Yesterday/');
      await expect(relativeDate).not.toBeVisible();
    });
  });

  test.describe('Stock Page', () => {
    test('should show notes section for sentiment tickers', async ({ page }) => {
      // AAPL should already be liked from beforeEach
      // Navigate to stock page
      const searchInput = page.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('AAPL');
      const result = page.locator('button:has-text("AAPL")').first();
      await result.click();
      await page.waitForSelector('text=Best Entry Months', { timeout: 15000 });

      // Should see "My Notes" section
      const notesSection = page.locator('[data-testid="stock-notes-section"]').or(page.locator('text="My Notes"')).first();
      await expect(notesSection).toBeVisible();
    });

    test('should allow editing notes from stock page', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('AAPL');
      const result = page.locator('button:has-text("AAPL")').first();
      await result.click();
      await page.waitForSelector('text=Best Entry Months', { timeout: 15000 });

      // Click add/edit note button
      const editBtn = page.locator('button:has-text("Edit"), button:has-text("Add"), [data-testid="stock-note-edit-button"]').first();
      await editBtn.click();

      // Type note
      const noteInput = page.locator('[data-testid="stock-note-input"], textarea[placeholder*="note" i]').first();
      await noteInput.fill('My thoughts on AAPL from stock page');

      // Save
      const saveBtn = page.locator('button:has-text("Save")').first();
      await saveBtn.click();
      await page.waitForTimeout(500);

      // Note should be visible
      const savedNote = page.locator('text=My thoughts on AAPL from stock page');
      await expect(savedNote).toBeVisible();
    });

    test('should not show notes section for non-sentiment tickers', async ({ page, request }) => {
      // Ensure MSFT has no sentiment (clear any leftover from previous tests)
      await request.delete('/api/ticker-sentiment/MSFT');

      // Reload page to clear any cached sentiment data
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Search for a ticker we haven't added to sentiment
      const searchInput = page.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('MSFT');
      const result = page.locator('button:has-text("MSFT")').first();
      await result.click();
      await page.waitForSelector('text=Best Entry Months', { timeout: 15000 });

      // Wait for page to stabilize
      await page.waitForTimeout(500);

      // Notes section should not be visible for neutral tickers
      const notesSection = page.locator('[data-testid="stock-notes-section"]');
      await expect(notesSection).not.toBeVisible();
    });
  });

  test.describe('Persistence & Validation', () => {
    test('should persist notes after page reload', async ({ page }) => {
      await page.click('a:has-text("My Tickers")');
      await page.waitForURL('**/#my-tickers');
      await page.waitForTimeout(500);

      // Add a note
      const noteBtn = page.locator('[data-testid="ticker-note-button"], button[title*="note" i], button:has-text("📝")').first();
      await noteBtn.click();

      const noteInput = page.locator('[data-testid="ticker-note-input"], textarea[placeholder*="note" i]').first();
      await noteInput.fill('Persistence test - this should survive reload');

      const saveBtn = page.locator('button:has-text("Save")').first();
      await saveBtn.click();
      await page.waitForTimeout(500);

      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.click('a:has-text("My Tickers")');
      await page.waitForURL('**/#my-tickers');

      // Wait for data to load by checking for AAPL ticker
      await page.waitForSelector('text=AAPL', { timeout: 10000 });
      await page.waitForTimeout(500);

      // Note should still be there (in preview or expanded)
      const savedNote = page.locator('text=Persistence test');
      await expect(savedNote.first()).toBeVisible({ timeout: 10000 });
    });

    test('should enforce 2000 character limit', async ({ page }) => {
      await page.click('a:has-text("My Tickers")');
      await page.waitForURL('**/#my-tickers');
      await page.waitForTimeout(500);

      // Open note editor
      const noteBtn = page.locator('[data-testid="ticker-note-button"], button[title*="note" i], button:has-text("📝")').first();
      await noteBtn.click();

      const noteInput = page.locator('[data-testid="ticker-note-input"], textarea[placeholder*="note" i]').first();
      await expect(noteInput).toBeVisible();

      // Try to type more than 2000 characters
      const longText = 'a'.repeat(2100);
      await noteInput.fill(longText);

      // Input should be limited to 2000 characters
      const inputValue = await noteInput.inputValue();
      expect(inputValue.length).toBeLessThanOrEqual(2000);
    });

    test('should allow clearing notes', async ({ page }) => {
      await page.click('a:has-text("My Tickers")');
      await page.waitForURL('**/#my-tickers');
      await page.waitForTimeout(500);

      // Add a note first
      const noteBtn = page.locator('[data-testid="ticker-note-button"], button[title*="note" i], button:has-text("📝")').first();
      await noteBtn.click();

      const noteInput = page.locator('[data-testid="ticker-note-input"], textarea[placeholder*="note" i]').first();
      await noteInput.fill('Note to be cleared');

      const saveBtn = page.locator('button:has-text("Save")').first();
      await saveBtn.click();
      await page.waitForTimeout(500);

      // Now clear the note
      await noteBtn.click();
      await noteInput.clear();
      await saveBtn.click();
      await page.waitForTimeout(500);

      // Note preview should not show old content
      const oldNote = page.locator('text=Note to be cleared');
      await expect(oldNote).not.toBeVisible();
    });
  });

  test.describe('API Endpoints', () => {
    test('PATCH /api/ticker-sentiment/:ticker/note should save note', async ({ request }) => {
      // Set a note via API
      const response = await request.patch('/api/ticker-sentiment/AAPL/note', {
        data: { note: 'API test note' }
      });
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.note).toBe('API test note');
    });

    test('GET /api/ticker-sentiment/detailed should include notes', async ({ request }) => {
      // First set a note
      await request.patch('/api/ticker-sentiment/AAPL/note', {
        data: { note: 'Detail test note' }
      });

      // Then fetch detailed data
      const response = await request.get('/api/ticker-sentiment/detailed');
      expect(response.status()).toBe(200);

      const data = await response.json();
      const aaplEntry = data.find((d: any) => d.ticker === 'AAPL');
      expect(aaplEntry).toBeDefined();
      expect(aaplEntry.note).toBe('Detail test note');
    });

    test('PATCH should reject notes over 2000 characters', async ({ request }) => {
      const longNote = 'a'.repeat(2100);
      const response = await request.patch('/api/ticker-sentiment/AAPL/note', {
        data: { note: longNote }
      });
      expect(response.status()).toBe(400);
    });
  });
});
