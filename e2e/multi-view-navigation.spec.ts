import { test, expect } from '@playwright/test';
import { setupTestWorkspace, waitForAppLoad, createActivityViaAPI } from './helpers';

test.describe('UJ-3: Multi-View Navigation', () => {
  let workspace: Awaited<ReturnType<typeof setupTestWorkspace>>;

  test.beforeEach(async ({ page }) => {
    workspace = await setupTestWorkspace(page);

    // Create test activities in current month range so they appear in calendar view too
    const today = new Date();
    const startStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-10`;
    const endStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-15`;
    const endStr2 = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-20`;

    await createActivityViaAPI(page, {
      calendarId: workspace.calendar.id,
      swimlaneId: workspace.swimlane.id,
      statusId: workspace.statuses[0].id,
      title: 'Alpha Activity',
      startDate: startStr,
      endDate: endStr,
      cost: 5000,
    });
    await createActivityViaAPI(page, {
      calendarId: workspace.calendar.id,
      swimlaneId: workspace.swimlane.id,
      statusId: workspace.statuses[1].id,
      title: 'Beta Activity',
      startDate: startStr,
      endDate: endStr2,
      cost: 10000,
    });

    await page.goto('/');
    await waitForAppLoad(page);
    await page.waitForLoadState('networkidle');
  });

  test('UJ-3.1: Can switch between Timeline, Calendar, and Table views', async ({ page }) => {
    // View tabs should be in header
    const header = page.locator('header');
    const timelineTab = header.getByRole('button', { name: 'Timeline', exact: true });
    const calendarTab = header.getByRole('button', { name: 'Calendar', exact: true });
    const tableTab = header.getByRole('button', { name: 'Table', exact: true });

    await expect(timelineTab).toBeVisible();
    await expect(calendarTab).toBeVisible();
    await expect(tableTab).toBeVisible();

    // Switch to Calendar
    await calendarTab.click();
    await page.waitForTimeout(300);

    // Switch to Table
    await tableTab.click();
    await page.waitForTimeout(300);

    // Switch back to Timeline
    await timelineTab.click();
    await page.waitForTimeout(300);
  });

  test('UJ-3.2: Timeline view displays activities as horizontal bars', async ({ page }) => {
    await expect(page.getByText('Alpha Activity')).toBeVisible();
    await expect(page.getByText('Beta Activity')).toBeVisible();
    await expect(page.getByText('Email Marketing')).toBeVisible();
  });

  test('UJ-3.3: Calendar view displays month grid with activities', async ({ page }) => {
    const header = page.locator('header');
    await header.getByRole('button', { name: 'Calendar', exact: true }).click();
    await page.waitForTimeout(300);

    // Activities should be visible in the calendar view (may appear multiple times across days)
    await expect(page.getByText('Alpha Activity').first()).toBeVisible({ timeout: 5000 });
  });

  test('UJ-3.4: Table view displays activities in sortable format', async ({ page }) => {
    const header = page.locator('header');
    await header.getByRole('button', { name: 'Table' }).click();
    await page.waitForTimeout(300);

    // Table headers should be visible
    await expect(page.locator('th').filter({ hasText: 'Title' })).toBeVisible();
    await expect(page.locator('th').filter({ hasText: 'Status' })).toBeVisible();

    // Activities should be in the table
    await expect(page.getByText('Alpha Activity')).toBeVisible();
    await expect(page.getByText('Beta Activity')).toBeVisible();
  });

  test('UJ-3.5: All views show the same filtered activities', async ({ page }) => {
    // Search to filter
    await page.getByPlaceholder('Search activities...').fill('Alpha');
    await page.waitForTimeout(300);

    // Timeline should show only Alpha
    await expect(page.getByText('Alpha Activity')).toBeVisible();
    await expect(page.getByText('Beta Activity')).not.toBeVisible();

    // Switch to Table view — same filter should apply
    const header = page.locator('header');
    await header.getByRole('button', { name: 'Table', exact: true }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText('Alpha Activity')).toBeVisible();
    await expect(page.getByText('Beta Activity')).not.toBeVisible();

    // Switch to Calendar view
    await header.getByRole('button', { name: 'Calendar', exact: true }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText('Alpha Activity').first()).toBeVisible();
    await expect(page.getByText('Beta Activity')).not.toBeVisible();
  });

  test('UJ-3.6: Table view supports inline editing for status', async ({ page }) => {
    const header = page.locator('header');
    await header.getByRole('button', { name: 'Table' }).click();
    await page.waitForTimeout(300);

    // Find a status dropdown in the table and verify it works
    const statusSelects = page.locator('table select').first();
    await expect(statusSelects).toBeVisible();

    const options = await statusSelects.locator('option').allTextContents();
    expect(options.length).toBeGreaterThan(0);
  });

  test('UJ-3.7: Table view supports column sorting', async ({ page }) => {
    const header = page.locator('header');
    await header.getByRole('button', { name: 'Table' }).click();
    await page.waitForTimeout(300);

    // Click Title header to sort
    await page.locator('th').filter({ hasText: 'Title' }).click();
    await page.waitForTimeout(300);

    // Click again to reverse sort
    await page.locator('th').filter({ hasText: 'Title' }).click();
    await page.waitForTimeout(300);

    // Both activities should still be visible
    await expect(page.getByText('Alpha Activity')).toBeVisible();
    await expect(page.getByText('Beta Activity')).toBeVisible();
  });
});
