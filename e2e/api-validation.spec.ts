import { test, expect } from '@playwright/test';
import { setupTestWorkspace, cleanupAllCalendars } from './helpers';

test.describe('FR-3 & FR-5: API Validation', () => {
  let workspace: Awaited<ReturnType<typeof setupTestWorkspace>>;

  test.beforeEach(async ({ page }) => {
    workspace = await setupTestWorkspace(page);
  });

  test('FR-3.5: API rejects endDate < startDate', async ({ page }) => {
    const response = await page.request.post('/api/activities', {
      data: {
        calendarId: workspace.calendar.id,
        swimlaneId: workspace.swimlane.id,
        statusId: workspace.statuses[0].id,
        title: 'Bad Date Activity',
        startDate: '2026-04-15',
        endDate: '2026-04-01', // Before start
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('End date');
  });

  test('FR-3.6a: API rejects missing title', async ({ page }) => {
    const response = await page.request.post('/api/activities', {
      data: {
        calendarId: workspace.calendar.id,
        swimlaneId: workspace.swimlane.id,
        statusId: workspace.statuses[0].id,
        title: '',
        startDate: '2026-04-01',
        endDate: '2026-04-15',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Title');
  });

  test('FR-3.6b: API rejects missing startDate', async ({ page }) => {
    const response = await page.request.post('/api/activities', {
      data: {
        calendarId: workspace.calendar.id,
        swimlaneId: workspace.swimlane.id,
        statusId: workspace.statuses[0].id,
        title: 'No Start Date',
        startDate: '',
        endDate: '2026-04-15',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Start date');
  });

  test('FR-3.6c: API rejects missing swimlaneId', async ({ page }) => {
    const response = await page.request.post('/api/activities', {
      data: {
        calendarId: workspace.calendar.id,
        swimlaneId: '',
        statusId: workspace.statuses[0].id,
        title: 'No Swimlane',
        startDate: '2026-04-01',
        endDate: '2026-04-15',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('swimlaneId');
  });

  test('FR-3.6d: API rejects missing statusId', async ({ page }) => {
    const response = await page.request.post('/api/activities', {
      data: {
        calendarId: workspace.calendar.id,
        swimlaneId: workspace.swimlane.id,
        statusId: '',
        title: 'No Status',
        startDate: '2026-04-01',
        endDate: '2026-04-15',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('statusId');
  });

  test('FR-3.7a: API verifies swimlane exists', async ({ page }) => {
    const response = await page.request.post('/api/activities', {
      data: {
        calendarId: workspace.calendar.id,
        swimlaneId: '00000000-0000-0000-0000-000000000000', // Non-existent
        statusId: workspace.statuses[0].id,
        title: 'Bad Swimlane',
        startDate: '2026-04-01',
        endDate: '2026-04-15',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Swimlane not found');
  });

  test('FR-3.7b: API verifies status exists', async ({ page }) => {
    const response = await page.request.post('/api/activities', {
      data: {
        calendarId: workspace.calendar.id,
        swimlaneId: workspace.swimlane.id,
        statusId: '00000000-0000-0000-0000-000000000000', // Non-existent
        title: 'Bad Status',
        startDate: '2026-04-01',
        endDate: '2026-04-15',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Status not found');
  });

  test('FR-5.1: New calendar auto-creates default statuses', async ({ page }) => {
    // Create a fresh calendar
    const response = await page.request.post('/api/calendars', {
      data: { name: 'Status Check Calendar' },
    });
    expect(response.ok()).toBeTruthy();

    const calendar = await response.json();
    expect(calendar.statuses).toBeDefined();
    expect(calendar.statuses.length).toBe(3);

    const names = calendar.statuses.map((s: { name: string }) => s.name);
    expect(names).toContain('Considering');
    expect(names).toContain('Negotiating');
    expect(names).toContain('Committed');
  });

  test('Calendar name is required', async ({ page }) => {
    const response = await page.request.post('/api/calendars', {
      data: { name: '' },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Name is required');
  });
});
