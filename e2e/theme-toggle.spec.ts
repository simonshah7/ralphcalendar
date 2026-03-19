import { test, expect } from '@playwright/test';
import { setupTestWorkspace, waitForAppLoad } from './helpers';

test.describe('UJ-7: Theme & Personalization', () => {
  test.beforeEach(async ({ page }) => {
    await setupTestWorkspace(page);
    await page.goto('/');
    await waitForAppLoad(page);
    await page.waitForLoadState('networkidle');
  });

  test('UJ-7.1: Can toggle between light and dark mode', async ({ page }) => {
    const htmlElement = page.locator('html');

    // Get initial dark mode state
    const initialClassList = await htmlElement.getAttribute('class') || '';
    const wasDark = initialClassList.includes('dark');

    // Find theme toggle by aria-label
    const themeToggle = page.getByLabel(/switch to (light|dark) mode/i).first();
    await themeToggle.click();
    await page.waitForTimeout(300);

    // Verify the theme changed
    const newClassList = await htmlElement.getAttribute('class') || '';
    const isNowDark = newClassList.includes('dark');
    expect(isNowDark).not.toBe(wasDark);
  });

  test('UJ-7.2: Theme preference persists across reloads', async ({ page }) => {
    const htmlElement = page.locator('html');

    // Get initial state
    const initialClassList = await htmlElement.getAttribute('class') || '';
    const wasDark = initialClassList.includes('dark');

    // Toggle theme
    const themeToggle = page.getByLabel(/switch to (light|dark) mode/i).first();
    await themeToggle.click();
    await page.waitForTimeout(300);

    const afterToggle = await htmlElement.getAttribute('class') || '';
    const isDarkAfterToggle = afterToggle.includes('dark');
    expect(isDarkAfterToggle).not.toBe(wasDark);

    // Reload page
    await page.reload();
    await waitForAppLoad(page);
    await page.waitForLoadState('networkidle');

    // Check theme persisted
    const afterReload = await page.locator('html').getAttribute('class') || '';
    const isDarkAfterReload = afterReload.includes('dark');
    expect(isDarkAfterReload).toBe(isDarkAfterToggle);
  });
});
