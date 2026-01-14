import { test, expect } from '@playwright/test';

/**
 * Issue #13: Add notes to favorited patterns
 *
 * Tests for the Notes feature on the Favorites page:
 * - Add notes to patterns with markdown text field
 * - Character counter (max 1000 chars)
 * - Display notes in both list and calendar views
 * - Edit and delete notes
 */

// Helper function to search for a stock
async function searchStock(page: any, ticker: string) {
  const searchInput = page.locator('input[placeholder*="earch"]').first();
  await searchInput.fill(ticker);

  const result = page.locator(`button:has-text("${ticker}")`).first();
  await result.click();

  // Wait for heatmap to load
  await page.waitForSelector('text=Best Entry Months', { timeout: 15000 });
}

// Helper function to add favorites from the Best Entry Months panel
async function addFavorites(page: any, count: number = 1) {
  await page.waitForTimeout(500);

  const heartButtons = page.locator('button').filter({
    has: page.locator('svg path[d*="4.318 6.318"]')
  });

  for (let i = 0; i < count; i++) {
    const heart = heartButtons.nth(i);
    await heart.click();
    await page.waitForTimeout(500);
  }
}

// Helper to navigate to favorites page using JavaScript click (bypasses overlay)
async function navigateToFavorites(page: any) {
  await page.evaluate(() => {
    const link = document.querySelector('a[href="#favorites"]') as HTMLElement;
    if (link) link.click();
  });
  await page.waitForURL('**/#favorites');
  await page.waitForSelector('h2:has-text("Favorite Patterns")', { timeout: 10000 });
  await page.waitForTimeout(2000);
}

test.describe('Favorites Notes Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Add note button is visible for favorites without notes', async ({ page }) => {
    // Add a favorite
    await searchStock(page, 'AAPL');
    await addFavorites(page, 1);

    // Navigate to favorites
    await navigateToFavorites(page);

    // Wait for AAPL to be visible
    await page.waitForSelector('text=AAPL', { timeout: 15000 });

    // Should see "Add note" button
    const addNoteButton = page.locator('[data-testid="edit-note-button"]').first();
    await expect(addNoteButton).toBeVisible({ timeout: 5000 });
    await expect(addNoteButton).toContainText('Add note');
  });

  test('clicking Add note opens note editor', async ({ page }) => {
    // Add a favorite
    await searchStock(page, 'AAPL');
    await addFavorites(page, 1);

    // Navigate to favorites
    await navigateToFavorites(page);
    await page.waitForSelector('text=AAPL', { timeout: 15000 });

    // Click Add note
    const addNoteButton = page.locator('[data-testid="edit-note-button"]').first();
    await addNoteButton.click();

    // Should see the note editor with textarea and character counter
    const textarea = page.locator('[data-testid="notes-input"]');
    const charCounter = page.locator('[data-testid="char-counter"]');

    await expect(textarea).toBeVisible({ timeout: 5000 });
    await expect(charCounter).toBeVisible();
    await expect(charCounter).toContainText('0/1000');
  });

  test('character counter updates as user types', async ({ page }) => {
    // Add a favorite
    await searchStock(page, 'AAPL');
    await addFavorites(page, 1);

    // Navigate to favorites
    await navigateToFavorites(page);
    await page.waitForSelector('text=AAPL', { timeout: 15000 });

    // Click Add note
    await page.locator('[data-testid="edit-note-button"]').first().click();

    const textarea = page.locator('[data-testid="notes-input"]');
    const charCounter = page.locator('[data-testid="char-counter"]');

    // Type some text
    await textarea.fill('This is a test note');
    await expect(charCounter).toContainText('19/1000');

    // Type more text
    await textarea.fill('This is a longer test note with more characters');
    await expect(charCounter).toContainText('48/1000');
  });

  test('can save a note and see it displayed', async ({ page }) => {
    // Add a favorite
    await searchStock(page, 'AAPL');
    await addFavorites(page, 1);

    // Navigate to favorites
    await navigateToFavorites(page);
    await page.waitForSelector('text=AAPL', { timeout: 15000 });

    // Click Add note
    await page.locator('[data-testid="edit-note-button"]').first().click();

    // Type a note
    const noteText = 'Buy in October for holiday rally';
    await page.locator('[data-testid="notes-input"]').fill(noteText);

    // Click Save
    await page.locator('button:has-text("Save")').click();
    await page.waitForTimeout(1000);

    // Should see the saved note displayed
    const savedNote = page.locator('[data-testid="notes-field"]');
    await expect(savedNote).toBeVisible({ timeout: 5000 });
    await expect(savedNote).toContainText(noteText);
  });

  test('can cancel note editing without saving', async ({ page }) => {
    // Add a favorite
    await searchStock(page, 'AAPL');
    await addFavorites(page, 1);

    // Navigate to favorites
    await navigateToFavorites(page);
    await page.waitForSelector('text=AAPL', { timeout: 15000 });

    // Click Add note
    await page.locator('[data-testid="edit-note-button"]').first().click();

    // Type a note
    await page.locator('[data-testid="notes-input"]').fill('This note should not be saved');

    // Click Cancel
    await page.locator('button:has-text("Cancel")').click();
    await page.waitForTimeout(500);

    // Should still see "Add note" button, not the saved note
    const addNoteButton = page.locator('[data-testid="edit-note-button"]').first();
    await expect(addNoteButton).toBeVisible({ timeout: 5000 });
  });

  test('can edit an existing note', async ({ page }) => {
    // Add a favorite
    await searchStock(page, 'AAPL');
    await addFavorites(page, 1);

    // Navigate to favorites
    await navigateToFavorites(page);
    await page.waitForSelector('text=AAPL', { timeout: 15000 });

    // Add initial note
    await page.locator('[data-testid="edit-note-button"]').first().click();
    await page.locator('[data-testid="notes-input"]').fill('Initial note');
    await page.locator('button:has-text("Save")').click();
    await page.waitForTimeout(1000);

    // Click on the saved note to edit
    await page.locator('[data-testid="notes-field"]').first().click();
    await page.waitForTimeout(500);

    // Should see editor with existing note
    const textarea = page.locator('[data-testid="notes-input"]');
    await expect(textarea).toBeVisible({ timeout: 5000 });
    await expect(textarea).toHaveValue('Initial note');

    // Update the note
    await textarea.fill('Updated note content');
    await page.locator('button:has-text("Save")').click();
    await page.waitForTimeout(1000);

    // Should see updated note
    const savedNote = page.locator('[data-testid="notes-field"]');
    await expect(savedNote).toContainText('Updated note content');
  });

  test('note character limit is enforced at 1000 characters', async ({ page }) => {
    // Add a favorite
    await searchStock(page, 'AAPL');
    await addFavorites(page, 1);

    // Navigate to favorites
    await navigateToFavorites(page);
    await page.waitForSelector('text=AAPL', { timeout: 15000 });

    // Click Add note
    await page.locator('[data-testid="edit-note-button"]').first().click();

    const textarea = page.locator('[data-testid="notes-input"]');
    const charCounter = page.locator('[data-testid="char-counter"]');

    // Try to type more than 1000 characters
    const longText = 'A'.repeat(1100);
    await textarea.fill(longText);

    // Should be limited to 1000
    await expect(charCounter).toContainText('1000/1000');
    const value = await textarea.inputValue();
    expect(value.length).toBe(1000);
  });

  test('notes appear in calendar view', async ({ page }) => {
    // Add a favorite
    await searchStock(page, 'AAPL');
    await addFavorites(page, 1);

    // Navigate to favorites
    await navigateToFavorites(page);
    await page.waitForSelector('text=AAPL', { timeout: 15000 });

    // Add a note in list view
    await page.locator('[data-testid="edit-note-button"]').first().click();
    await page.locator('[data-testid="notes-input"]').fill('Test note for calendar');
    await page.locator('button:has-text("Save")').click();
    await page.waitForTimeout(1000);

    // Switch to calendar view
    await page.locator('button:has-text("Calendar")').click();
    await page.waitForTimeout(500);

    // Should see the note in calendar view (with emoji prefix)
    const noteInCalendar = page.locator('text=/Test note for calendar/');
    await expect(noteInCalendar).toBeVisible({ timeout: 5000 });
  });

  test('Notes column header is visible in list view', async ({ page }) => {
    // Add a favorite
    await searchStock(page, 'AAPL');
    await addFavorites(page, 1);

    // Navigate to favorites
    await navigateToFavorites(page);
    await page.waitForSelector('text=AAPL', { timeout: 15000 });

    // Should see Notes column header in table
    const notesHeader = page.locator('th:has-text("Notes")');
    await expect(notesHeader).toBeVisible({ timeout: 5000 });
  });
});
