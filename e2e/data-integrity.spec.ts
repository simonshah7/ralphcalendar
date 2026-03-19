import { test, expect } from '@playwright/test';
import {
  setupTestWorkspace,
  waitForAppLoad,
  createActivityViaAPI,
  createSwimlaneViaAPI,
  getCalendarData,
} from './helpers';

test.describe('BR-3: Data Integrity', () => {
  let workspace: Awaited<ReturnType<typeof setupTestWorkspace>>;

  test.beforeEach(async ({ page }) => {
    workspace = await setupTestWorkspace(page);
  });

  test('BR-3.1: Activities persist across page reloads', async ({ page }) => {
    // Create activity via API
    await createActivityViaAPI(page, {
      calendarId: workspace.calendar.id,
      swimlaneId: workspace.swimlane.id,
      statusId: workspace.statuses[0].id,
      title: 'Persistence Test',
      startDate: '2026-04-01',
      endDate: '2026-04-15',
      cost: 1500,
      description: 'Testing data persistence',
    });

    // Load page
    await page.goto('/');
    await waitForAppLoad(page);
    await page.waitForLoadState('networkidle');

    // Switch to table for easier verification
    await page.getByRole('button', { name: 'Table' }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText('Persistence Test')).toBeVisible();

    // Reload
    await page.reload();
    await waitForAppLoad(page);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Table' }).click();
    await page.waitForTimeout(300);

    // Still there
    await expect(page.getByText('Persistence Test')).toBeVisible();
  });

  test('BR-3.2: Deleting swimlane cascades to activities', async ({ page }) => {
    // Create a second swimlane with an activity
    const doomed = await createSwimlaneViaAPI(page, workspace.calendar.id, 'Doomed Swimlane');
    await createActivityViaAPI(page, {
      calendarId: workspace.calendar.id,
      swimlaneId: doomed.id,
      statusId: workspace.statuses[0].id,
      title: 'Doomed Activity',
      startDate: '2026-04-01',
      endDate: '2026-04-15',
    });

    // Verify activity exists
    let calData = await getCalendarData(page, workspace.calendar.id);
    const activityBefore = calData.activities.find(
      (a: { title: string }) => a.title === 'Doomed Activity'
    );
    expect(activityBefore).toBeTruthy();

    // Delete the swimlane
    const response = await page.request.delete(`/api/swimlanes/${doomed.id}`);
    expect(response.ok()).toBeTruthy();

    // Verify activity is gone
    calData = await getCalendarData(page, workspace.calendar.id);
    const activityAfter = calData.activities.find(
      (a: { title: string }) => a.title === 'Doomed Activity'
    );
    expect(activityAfter).toBeUndefined();
  });

  test('BR-3.3: Deleting calendar cascades to all children', async ({ page }) => {
    // Create activity in workspace
    await createActivityViaAPI(page, {
      calendarId: workspace.calendar.id,
      swimlaneId: workspace.swimlane.id,
      statusId: workspace.statuses[0].id,
      title: 'Cascade Test',
      startDate: '2026-04-01',
      endDate: '2026-04-15',
    });

    // Delete calendar
    const response = await page.request.delete(`/api/calendars/${workspace.calendar.id}`);
    expect(response.ok()).toBeTruthy();

    // Verify calendar is gone
    const calendarsResponse = await page.request.get('/api/calendars');
    const calendars = await calendarsResponse.json();
    const found = calendars.find((c: { id: string }) => c.id === workspace.calendar.id);
    expect(found).toBeUndefined();

    // Verify activities for that calendar are gone
    const activitiesResponse = await page.request.get(
      `/api/activities?calendarId=${workspace.calendar.id}`
    );
    const activities = await activitiesResponse.json();
    expect(activities.length).toBe(0);
  });

  test('BR-3.4: Activity dates remain correct after creation and editing', async ({ page }) => {
    // Create activity
    const created = await createActivityViaAPI(page, {
      calendarId: workspace.calendar.id,
      swimlaneId: workspace.swimlane.id,
      statusId: workspace.statuses[0].id,
      title: 'Date Check',
      startDate: '2026-05-10',
      endDate: '2026-05-20',
    });

    // Verify dates
    expect(created.startDate).toBe('2026-05-10');
    expect(created.endDate).toBe('2026-05-20');

    // Update dates
    const updateResponse = await page.request.put(`/api/activities/${created.id}`, {
      data: { startDate: '2026-06-01', endDate: '2026-06-15' },
    });
    expect(updateResponse.ok()).toBeTruthy();

    const updated = await updateResponse.json();
    expect(updated.startDate).toBe('2026-06-01');
    expect(updated.endDate).toBe('2026-06-15');

    // Verify via GET
    const calData = await getCalendarData(page, workspace.calendar.id);
    const activity = calData.activities.find((a: { id: string }) => a.id === created.id);
    expect(activity.startDate).toBe('2026-06-01');
    expect(activity.endDate).toBe('2026-06-15');
  });
});
