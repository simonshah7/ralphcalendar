import { test, expect } from '@playwright/test';
import { setupTestWorkspace, waitForAppLoad, createActivityViaAPI } from './helpers';

test.describe('UJ-6: Data Export', () => {
  let workspace: Awaited<ReturnType<typeof setupTestWorkspace>>;

  test.beforeEach(async ({ page }) => {
    workspace = await setupTestWorkspace(page);
    await createActivityViaAPI(page, {
      calendarId: workspace.calendar.id,
      swimlaneId: workspace.swimlane.id,
      statusId: workspace.statuses[0].id,
      title: 'Export Test Activity',
      startDate: '2026-03-15',
      endDate: '2026-03-20',
    });

    await page.goto('/');
    await waitForAppLoad(page);
    await page.waitForTimeout(1000);
  });

  test('UJ-6.1: Can open the export modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Export' }).click();
    await page.waitForTimeout(300);

    await expect(page.getByText('Export Data')).toBeVisible();
  });

  test('UJ-6.2: Export modal allows selecting view type', async ({ page }) => {
    await page.getByRole('button', { name: 'Export' }).click();
    await page.waitForTimeout(300);

    // All three view type buttons should be visible
    const modal = page.locator('.fixed.inset-0');
    await expect(modal.getByRole('button', { name: 'timeline' })).toBeVisible();
    await expect(modal.getByRole('button', { name: 'calendar' })).toBeVisible();
    await expect(modal.getByRole('button', { name: 'table' })).toBeVisible();

    // Click table
    await modal.getByRole('button', { name: 'table' }).click();
    await page.waitForTimeout(200);
  });

  test('UJ-6.3: Export modal allows selecting format (PNG/CSV)', async ({ page }) => {
    await page.getByRole('button', { name: 'Export' }).click();
    await page.waitForTimeout(300);

    const modal = page.locator('.fixed.inset-0');
    await expect(modal.getByRole('button', { name: 'PNG Image' })).toBeVisible();
    await expect(modal.getByRole('button', { name: 'CSV Spreadsheet' })).toBeVisible();
  });

  test('UJ-6.4: CSV export only available for Table view', async ({ page }) => {
    await page.getByRole('button', { name: 'Export' }).click();
    await page.waitForTimeout(300);

    const modal = page.locator('.fixed.inset-0');
    const csvButton = modal.getByRole('button', { name: 'CSV Spreadsheet' });

    // Timeline view — CSV should be disabled
    await expect(csvButton).toBeDisabled();

    // Switch to table
    await modal.getByRole('button', { name: 'table' }).click();
    await page.waitForTimeout(200);

    // CSV should now be enabled
    await expect(csvButton).toBeEnabled();

    // Helper text should not show when table is selected
    await expect(page.getByText('CSV export is only available for Table view')).not.toBeVisible();
  });

  test('UJ-6.5: Export modal has quick date range selectors', async ({ page }) => {
    await page.getByRole('button', { name: 'Export' }).click();
    await page.waitForTimeout(300);

    const modal = page.locator('.fixed.inset-0');
    await expect(modal.getByRole('button', { name: 'This Month' })).toBeVisible();
    await expect(modal.getByRole('button', { name: 'This Quarter' })).toBeVisible();
    await expect(modal.getByRole('button', { name: 'This Year' })).toBeVisible();
    await expect(modal.getByRole('button', { name: 'All Time' })).toBeVisible();

    // Click "This Year" and verify dates update
    await modal.getByRole('button', { name: 'This Year' }).click();
    await page.waitForTimeout(200);

    // Date inputs should reflect year range
    const fromDate = modal.locator('input[type="date"]').first();
    const toDate = modal.locator('input[type="date"]').last();
    await expect(fromDate).toHaveValue('2026-01-01');
    await expect(toDate).toHaveValue('2026-12-31');
  });

  test('UJ-6.6: Export modal allows custom date range', async ({ page }) => {
    await page.getByRole('button', { name: 'Export' }).click();
    await page.waitForTimeout(300);

    const modal = page.locator('.fixed.inset-0');
    const fromDate = modal.locator('input[type="date"]').first();
    const toDate = modal.locator('input[type="date"]').last();

    await fromDate.fill('2026-06-01');
    await toDate.fill('2026-09-30');

    await expect(fromDate).toHaveValue('2026-06-01');
    await expect(toDate).toHaveValue('2026-09-30');
  });
});
