import { test, expect } from '@playwright/test';
import {
  setupTestWorkspace,
  waitForAppLoad,
  createCalendarViaAPI,
  createSwimlaneViaAPI,
  createActivityViaAPI,
  cleanupAllCalendars,
} from './helpers';

test.describe('UJ-5: Workspace Management', () => {
  test.beforeEach(async ({ page }) => {
    await cleanupAllCalendars(page);
  });

  test('UJ-5.1: Can create additional calendars via workspace switcher', async ({ page }) => {
    await setupTestWorkspace(page, 'First Calendar');

    await page.goto('/');
    await waitForAppLoad(page);
    await page.waitForTimeout(1500);

    // Open workspace switcher — click the calendar name button
    await page.locator('header').getByText('First Calendar').click();
    await page.waitForTimeout(300);

    // Click Create New Calendar
    await page.getByText('Create New Calendar').click();
    await page.waitForTimeout(300);

    // Fill in name
    await page.getByPlaceholder('My Marketing Calendar').fill('Second Calendar');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForTimeout(1500);

    // Should now show the new calendar
    await expect(page.getByText('Second Calendar')).toBeVisible();
  });

  test('UJ-5.2: Can switch between calendars and see different activities', async ({ page }) => {
    // Create two calendars with different activities
    const cal1 = await createCalendarViaAPI(page, 'Calendar A');
    const cal1Data = await page.request.get(`/api/calendars/${cal1.id}`);
    const cal1Info = await cal1Data.json();
    const swim1 = await createSwimlaneViaAPI(page, cal1.id, 'Swim A');
    await createActivityViaAPI(page, {
      calendarId: cal1.id,
      swimlaneId: swim1.id,
      statusId: cal1Info.statuses[0].id,
      title: 'Activity In Cal A',
      startDate: '2026-03-15',
      endDate: '2026-03-20',
    });

    const cal2 = await createCalendarViaAPI(page, 'Calendar B');
    const cal2Data = await page.request.get(`/api/calendars/${cal2.id}`);
    const cal2Info = await cal2Data.json();
    const swim2 = await createSwimlaneViaAPI(page, cal2.id, 'Swim B');
    await createActivityViaAPI(page, {
      calendarId: cal2.id,
      swimlaneId: swim2.id,
      statusId: cal2Info.statuses[0].id,
      title: 'Activity In Cal B',
      startDate: '2026-03-15',
      endDate: '2026-03-20',
    });

    await page.goto('/');
    await waitForAppLoad(page);
    await page.waitForTimeout(1500);

    // Switch to table view for easier checking
    const header = page.locator('header');
    await header.getByRole('button', { name: 'Table' }).click();
    await page.waitForTimeout(500);

    // Should show Calendar A activities first
    await expect(page.getByText('Activity In Cal A')).toBeVisible();

    // Switch to Calendar B via workspace switcher
    await header.getByText('Calendar A', { exact: true }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Calendar B' }).click();
    await page.waitForTimeout(1500);

    // Should now show Calendar B activities
    await expect(page.getByText('Activity In Cal B')).toBeVisible();
    await expect(page.getByText('Activity In Cal A')).not.toBeVisible();
  });

  test('UJ-5.3: Can add swimlanes from timeline sidebar', async ({ page }) => {
    await setupTestWorkspace(page, 'Swimlane Test');

    await page.goto('/');
    await waitForAppLoad(page);
    await page.waitForTimeout(1500);

    // Click the add swimlane button (+ icon) in the sidebar
    const addButton = page.locator('button[title="Add swimlane"]');
    await addButton.click();
    await page.waitForTimeout(300);

    // Fill in swimlane name
    const swimlaneInput = page.getByPlaceholder('Swimlane name...');
    await swimlaneInput.fill('Paid Media');

    // Click the Add button (exact match to avoid the "Add swimlane" title button)
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.waitForTimeout(1500);

    // New swimlane should appear
    await expect(page.getByText('Paid Media')).toBeVisible();
  });

  test('UJ-5.4: Can edit swimlane names', async ({ page }) => {
    await setupTestWorkspace(page, 'Edit Swimlane Test');

    await page.goto('/');
    await waitForAppLoad(page);
    await page.waitForTimeout(1500);

    // Double-click the swimlane name to enter edit mode
    await page.getByText('Email Marketing').dblclick();
    await page.waitForTimeout(300);

    // Type new name in the edit input that appeared
    const editInput = page.locator('[draggable] input[type="text"]');
    await editInput.fill('Renamed Swimlane');
    await editInput.press('Enter');
    await page.waitForTimeout(1500);

    // Should show updated name
    await expect(page.getByText('Renamed Swimlane')).toBeVisible();
  });

  test('UJ-5.5: Can delete swimlanes with confirmation', async ({ page }) => {
    const workspace = await setupTestWorkspace(page, 'Delete Swimlane Test');
    // Add a second swimlane so we can delete one
    await createSwimlaneViaAPI(page, workspace.calendar.id, 'To Delete');

    await page.goto('/');
    await waitForAppLoad(page);
    await page.waitForTimeout(1500);

    // Hover over the "To Delete" swimlane to reveal delete button
    const swimlaneRow = page.locator('[draggable]').filter({ hasText: 'To Delete' });
    await swimlaneRow.hover();
    await page.waitForTimeout(500);

    const deleteButton = swimlaneRow.locator('button[title="Delete swimlane"]');
    await deleteButton.click();
    await page.waitForTimeout(500);

    // Confirmation dialog should appear
    await expect(page.getByText('Are you sure')).toBeVisible();

    // Confirm deletion via API approach if dialog buttons conflict
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
    await page.waitForTimeout(1500);

    // Swimlane should be gone
    await expect(page.locator('[draggable]').filter({ hasText: 'To Delete' })).not.toBeVisible();
    // Original swimlane should still exist
    await expect(page.getByText('Email Marketing')).toBeVisible();
  });
});
