import { test, expect } from '@playwright/test';
import { cleanupAllCalendars, waitForAppLoad } from './helpers';

test.describe('UJ-1: First-Time Setup', () => {
  test.beforeEach(async ({ page }) => {
    await cleanupAllCalendars(page);
    await page.goto('/');
    await waitForAppLoad(page);
  });

  test('UJ-1.1: Shows welcome screen when no calendars exist', async ({ page }) => {
    await expect(page.getByText('Welcome to CampaignOS')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Create Your First Calendar' })).toBeVisible();
  });

  test('UJ-1.2: Can create a calendar via the welcome CTA', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Create Your First Calendar' })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Create Your First Calendar' }).click();
    await expect(page.getByText('Create Calendar')).toBeVisible();

    await page.getByPlaceholder('My Marketing Calendar').fill('Q3 Marketing Plan');
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    await expect(page.getByText('Welcome to CampaignOS')).not.toBeVisible({ timeout: 10000 });
  });

  test('UJ-1.3: Default statuses are created for new calendar', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Create Your First Calendar' })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Create Your First Calendar' }).click();
    await page.getByPlaceholder('My Marketing Calendar').fill('Status Test');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.waitForTimeout(2000);

    const calendars = await page.request.get('/api/calendars');
    const calendarList = await calendars.json();
    expect(calendarList.length).toBeGreaterThan(0);

    const calData = await page.request.get(`/api/calendars/${calendarList[calendarList.length - 1].id}`);
    const calendar = await calData.json();
    const statusNames = calendar.statuses.map((s: { name: string }) => s.name);
    expect(statusNames).toContain('Considering');
    expect(statusNames).toContain('Negotiating');
    expect(statusNames).toContain('Committed');
  });

  test('UJ-1.4: After calendar creation, shows swimlane prompt', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Create Your First Calendar' })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Create Your First Calendar' }).click();
    await page.getByPlaceholder('My Marketing Calendar').fill('Swimlane Test');
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    await expect(page.getByText('Add Swimlanes to Get Started')).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder('Enter swimlane name')).toBeVisible();
  });

  test('UJ-1.5: Can add a swimlane via the empty state input', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Create Your First Calendar' })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Create Your First Calendar' }).click();
    await page.getByPlaceholder('My Marketing Calendar').fill('Swimlane Add Test');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByPlaceholder('Enter swimlane name')).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder('Enter swimlane name').fill('Email Channel');
    await page.getByPlaceholder('Enter swimlane name').press('Enter');

    await expect(page.getByText('Add Swimlanes to Get Started')).not.toBeVisible({ timeout: 10000 });
  });

  test('UJ-1.6: Timeline renders with swimlane row after adding swimlane', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Create Your First Calendar' })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Create Your First Calendar' }).click();
    await page.getByPlaceholder('My Marketing Calendar').fill('Timeline Test');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByPlaceholder('Enter swimlane name')).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder('Enter swimlane name').fill('Social Media');
    await page.getByPlaceholder('Enter swimlane name').press('Enter');

    await expect(page.getByText('Social Media')).toBeVisible({ timeout: 10000 });
  });
});
