import { test, expect } from '@playwright/test';

/**
 * Issue #13: Add notes to favorited patterns
 *
 * Acceptance Criteria:
 * - Markdown text field (max 1000 characters) on favorites
 * - Edit notes inline with character counter
 * - Notes displayed in favorites list and calendar view
 */

test.describe('Issue #13: Notes for Favorited Patterns', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Add a favorite first
    const searchInput = page.getByRole('textbox', { name: /Search for a stock ticker/ });
    await searchInput.fill('AAPL');
    const result = page.getByRole('button', { name: /AAPL.*Tier/i });
    await result.click();
    await page.waitForSelector('text=Best Entry Months', { timeout: 15000 });

    // Add favorite
    const unfilledStar = page.locator('button:has-text("☆")').first();
    await unfilledStar.click();
    await page.waitForTimeout(300);
  });

  test('should show notes text field on favorites page', async ({ page }) => {
    // Navigate to favorites
    await page.click('a:has-text("Favorites")');
    await page.waitForURL('**/#favorites');
    await page.waitForTimeout(500);

    // Should have a notes field or "Add note" button for each favorite
    const notesField = page.locator('[data-testid="notes-field"], button:has-text("Add note")').first();
    await expect(notesField).toBeVisible();
  });

  test('should allow editing notes inline', async ({ page }) => {
    await page.click('a:has-text("Favorites")');
    await page.waitForURL('**/#favorites');
    await page.waitForTimeout(500);

    // Click to add/edit note
    const addNoteBtn = page.locator('button:has-text("Add note"), [data-testid="edit-note-button"]').first();
    if (await addNoteBtn.isVisible()) {
      await addNoteBtn.click();
    }

    // Find the text input
    const notesInput = page.locator('[data-testid="notes-input"], textarea[placeholder*="note"]').first();
    await expect(notesInput).toBeVisible();

    // Type a note
    await notesInput.fill('This pattern looks strong for Q1 earnings season');

    // Save the note
    const saveBtn = page.locator('button:has-text("Save"), button:has-text("Done")').first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
    }

    // Note should be saved and displayed
    await page.waitForTimeout(300);
    const savedNote = page.locator('text=This pattern looks strong');
    await expect(savedNote).toBeVisible();
  });

  test('should enforce 1000 character limit', async ({ page }) => {
    await page.click('a:has-text("Favorites")');
    await page.waitForURL('**/#favorites');

    // Open note editor
    const addNoteBtn = page.locator('button:has-text("Add note"), [data-testid="edit-note-button"]').first();
    if (await addNoteBtn.isVisible()) {
      await addNoteBtn.click();
    }

    const notesInput = page.locator('[data-testid="notes-input"], textarea[placeholder*="note"]').first();
    await expect(notesInput).toBeVisible();

    // Try to type more than 1000 characters
    const longText = 'a'.repeat(1050);
    await notesInput.fill(longText);

    // Input should be limited to 1000 characters
    const inputValue = await notesInput.inputValue();
    expect(inputValue.length).toBeLessThanOrEqual(1000);
  });

  test('should show character counter', async ({ page }) => {
    await page.click('a:has-text("Favorites")');
    await page.waitForURL('**/#favorites');

    // Open note editor
    const addNoteBtn = page.locator('button:has-text("Add note"), [data-testid="edit-note-button"]').first();
    if (await addNoteBtn.isVisible()) {
      await addNoteBtn.click();
    }

    const notesInput = page.locator('[data-testid="notes-input"], textarea[placeholder*="note"]').first();
    await notesInput.fill('Test note');

    // Character counter should be visible
    const charCounter = page.locator('[data-testid="char-counter"], text=/\\d+.*\\/.*1000/');
    await expect(charCounter).toBeVisible();
  });

  test('should display notes in calendar view', async ({ page }) => {
    // First add a note
    await page.click('a:has-text("Favorites")');
    await page.waitForURL('**/#favorites');

    const addNoteBtn = page.locator('button:has-text("Add note"), [data-testid="edit-note-button"]').first();
    if (await addNoteBtn.isVisible()) {
      await addNoteBtn.click();
    }

    const notesInput = page.locator('[data-testid="notes-input"], textarea[placeholder*="note"]').first();
    await notesInput.fill('Calendar note test');

    const saveBtn = page.locator('button:has-text("Save"), button:has-text("Done")').first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
    }
    await page.waitForTimeout(300);

    // Switch to calendar view
    await page.click('button:has-text("Calendar")');
    await page.waitForTimeout(500);

    // Note should be visible in calendar view
    const noteInCalendar = page.locator('text=Calendar note test');
    await expect(noteInCalendar).toBeVisible();
  });

  test('should persist notes after page reload', async ({ page }) => {
    await page.click('a:has-text("Favorites")');
    await page.waitForURL('**/#favorites');

    // Add a note
    const addNoteBtn = page.locator('button:has-text("Add note"), [data-testid="edit-note-button"]').first();
    if (await addNoteBtn.isVisible()) {
      await addNoteBtn.click();
    }

    const notesInput = page.locator('[data-testid="notes-input"], textarea[placeholder*="note"]').first();
    await notesInput.fill('Persistence test note');

    const saveBtn = page.locator('button:has-text("Save"), button:has-text("Done")').first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
    }
    await page.waitForTimeout(500);

    // Reload page
    await page.reload();
    await page.click('a:has-text("Favorites")');
    await page.waitForURL('**/#favorites');
    await page.waitForTimeout(500);

    // Note should still be there
    const savedNote = page.locator('text=Persistence test note');
    await expect(savedNote).toBeVisible();
  });
});
