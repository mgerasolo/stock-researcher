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

  test('Notes column header exists in favorites table', async ({ page }) => {
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

  test('can open note editor from favorites list', async ({ page }) => {
    // Add a favorite
    await searchStock(page, 'AAPL');
    await addFavorites(page, 1);

    // Navigate to favorites
    await navigateToFavorites(page);
    await page.waitForSelector('text=AAPL', { timeout: 15000 });

    // Click on "Add note" button or existing note field (whichever is visible)
    const noteButton = page.locator('[data-testid="edit-note-button"]').first();
    const noteField = page.locator('[data-testid="notes-field"]').first();

    // Try to click whichever is visible
    if (await noteButton.isVisible()) {
      await noteButton.click();
    } else if (await noteField.isVisible()) {
      await noteField.click();
    } else {
      throw new Error('Neither Add note button nor notes field is visible');
    }

    await page.waitForTimeout(500);

    // Should see the note editor with textarea and character counter
    const textarea = page.locator('[data-testid="notes-input"]');
    const charCounter = page.locator('[data-testid="char-counter"]');

    await expect(textarea).toBeVisible({ timeout: 5000 });
    await expect(charCounter).toBeVisible();
    await expect(charCounter).toContainText('/1000');
  });

  test('character counter updates when typing in note editor', async ({ page }) => {
    // Add a favorite
    await searchStock(page, 'AAPL');
    await addFavorites(page, 1);

    // Navigate to favorites
    await navigateToFavorites(page);
    await page.waitForSelector('text=AAPL', { timeout: 15000 });

    // Open note editor
    const noteButton = page.locator('[data-testid="edit-note-button"]').first();
    const noteField = page.locator('[data-testid="notes-field"]').first();

    if (await noteButton.isVisible()) {
      await noteButton.click();
    } else {
      await noteField.click();
    }
    await page.waitForTimeout(500);

    const textarea = page.locator('[data-testid="notes-input"]');
    const charCounter = page.locator('[data-testid="char-counter"]');

    // Clear and type some text (19 characters)
    await textarea.fill('This is a test note');
    await expect(charCounter).toContainText('19/1000');

    // Type more text (47 characters)
    await textarea.fill('This is a longer test note with more characters');
    await expect(charCounter).toContainText('47/1000');
  });

  test('can save note and see it displayed', async ({ page }) => {
    // Add a favorite
    await searchStock(page, 'AAPL');
    await addFavorites(page, 1);

    // Navigate to favorites
    await navigateToFavorites(page);
    await page.waitForSelector('text=AAPL', { timeout: 15000 });

    // Open note editor
    const noteButton = page.locator('[data-testid="edit-note-button"]').first();
    const noteField = page.locator('[data-testid="notes-field"]').first();

    if (await noteButton.isVisible()) {
      await noteButton.click();
    } else {
      await noteField.click();
    }
    await page.waitForTimeout(500);

    // Type a unique note
    const noteText = 'Unique test note ' + Date.now();
    await page.locator('[data-testid="notes-input"]').fill(noteText);

    // Click Save
    await page.locator('button:has-text("Save")').click();
    await page.waitForTimeout(1000);

    // Should see a notes field (saved note is displayed)
    const savedNote = page.locator('[data-testid="notes-field"]').first();
    await expect(savedNote).toBeVisible({ timeout: 5000 });
  });

  test('can cancel note editing without saving', async ({ page }) => {
    // Add a favorite
    await searchStock(page, 'AAPL');
    await addFavorites(page, 1);

    // Navigate to favorites
    await navigateToFavorites(page);
    await page.waitForSelector('text=AAPL', { timeout: 15000 });

    // Open note editor
    const noteButton = page.locator('[data-testid="edit-note-button"]').first();
    const noteField = page.locator('[data-testid="notes-field"]').first();

    if (await noteButton.isVisible()) {
      await noteButton.click();
    } else {
      await noteField.click();
    }
    await page.waitForTimeout(500);

    // Type a note
    await page.locator('[data-testid="notes-input"]').fill('This should not be saved');

    // Click Cancel
    await page.locator('button:has-text("Cancel")').click();
    await page.waitForTimeout(500);

    // Note editor should be closed
    const notesInput = page.locator('[data-testid="notes-input"]');
    await expect(notesInput).not.toBeVisible({ timeout: 5000 });
  });

  test('note character limit enforced at 1000', async ({ page }) => {
    // Add a favorite
    await searchStock(page, 'AAPL');
    await addFavorites(page, 1);

    // Navigate to favorites
    await navigateToFavorites(page);
    await page.waitForSelector('text=AAPL', { timeout: 15000 });

    // Open note editor
    const noteButton = page.locator('[data-testid="edit-note-button"]').first();
    const noteField = page.locator('[data-testid="notes-field"]').first();

    if (await noteButton.isVisible()) {
      await noteButton.click();
    } else {
      await noteField.click();
    }
    await page.waitForTimeout(500);

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

  test('notes visible in calendar view', async ({ page }) => {
    // Add a favorite and note
    await searchStock(page, 'AAPL');
    await addFavorites(page, 1);

    // Navigate to favorites
    await navigateToFavorites(page);
    await page.waitForSelector('text=AAPL', { timeout: 15000 });

    // Add a note in list view
    const noteButton = page.locator('[data-testid="edit-note-button"]').first();
    const noteField = page.locator('[data-testid="notes-field"]').first();

    if (await noteButton.isVisible()) {
      await noteButton.click();
    } else {
      await noteField.click();
    }
    await page.waitForTimeout(500);

    const uniqueNote = 'Calendar test note ' + Date.now();
    await page.locator('[data-testid="notes-input"]').fill(uniqueNote);
    await page.locator('button:has-text("Save")').click();
    await page.waitForTimeout(1000);

    // Switch to calendar view
    await page.locator('button:has-text("Calendar")').click();
    await page.waitForTimeout(500);

    // Should see the note emoji in calendar view (notes displayed with emoji prefix)
    const noteInCalendar = page.locator('text=/Calendar test note/').first();
    await expect(noteInCalendar).toBeVisible({ timeout: 5000 });
  });
});
