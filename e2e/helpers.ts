import { Page, expect } from '@playwright/test';

/**
 * Shared helpers for LaunchGrid E2E tests.
 * These use the API directly to set up test state quickly.
 */

/** Wait for the app to finish loading (spinner disappears) */
export async function waitForAppLoad(page: Page) {
  // Wait for the loading spinner to disappear or LaunchGrid text to appear
  await page.waitForSelector('text=LaunchGrid', { timeout: 15000 });
  // Small delay for any additional data fetching
  await page.waitForTimeout(500);
}

/** Create a calendar via the API and return its data */
export async function createCalendarViaAPI(page: Page, name: string) {
  const response = await page.request.post('/api/calendars', {
    data: { name },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

/** Create a swimlane via the API */
export async function createSwimlaneViaAPI(page: Page, calendarId: string, name: string) {
  const response = await page.request.post('/api/swimlanes', {
    data: { calendarId, name },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

/** Create a campaign via the API */
export async function createCampaignViaAPI(page: Page, calendarId: string, name: string) {
  const response = await page.request.post('/api/campaigns', {
    data: { calendarId, name },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

/** Create an activity via the API */
export async function createActivityViaAPI(
  page: Page,
  data: {
    calendarId: string;
    swimlaneId: string;
    statusId: string;
    title: string;
    startDate: string;
    endDate: string;
    campaignId?: string;
    cost?: number;
    currency?: string;
    region?: string;
    tags?: string;
    description?: string;
  }
) {
  const response = await page.request.post('/api/activities', { data });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

/** Get full calendar data (with statuses, swimlanes, etc.) */
export async function getCalendarData(page: Page, calendarId: string) {
  const response = await page.request.get(`/api/calendars/${calendarId}`);
  expect(response.ok()).toBeTruthy();
  return response.json();
}

/** Delete all calendars to reset state */
export async function cleanupAllCalendars(page: Page) {
  const response = await page.request.get('/api/calendars');
  const calendars = await response.json();
  for (const cal of calendars) {
    await page.request.delete(`/api/calendars/${cal.id}`);
  }
}

/**
 * Set up a full test workspace: calendar + swimlane + statuses ready.
 * Returns { calendar, swimlane, statuses }
 */
export async function setupTestWorkspace(page: Page, calendarName = 'Test Calendar') {
  // Clean first
  await cleanupAllCalendars(page);

  // Create calendar (auto-creates default statuses)
  const calendar = await createCalendarViaAPI(page, calendarName);
  const calData = await getCalendarData(page, calendar.id);

  // Create a swimlane
  const swimlane = await createSwimlaneViaAPI(page, calendar.id, 'Email Marketing');

  return {
    calendar: calData,
    swimlane,
    statuses: calData.statuses,
  };
}
