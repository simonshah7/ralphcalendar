import { test, expect } from '@playwright/test';
import {
  setupTestWorkspace,
  waitForAppLoad,
  createActivityViaAPI,
  createCampaignViaAPI,
} from './helpers';

test.describe('UJ-4: Filtering & Search', () => {
  let workspace: Awaited<ReturnType<typeof setupTestWorkspace>>;
  let campaign: { id: string; name: string };

  test.beforeEach(async ({ page }) => {
    workspace = await setupTestWorkspace(page);

    // Create a campaign
    campaign = await createCampaignViaAPI(page, workspace.calendar.id, 'Spring Campaign');

    // Create activities with different attributes
    await createActivityViaAPI(page, {
      calendarId: workspace.calendar.id,
      swimlaneId: workspace.swimlane.id,
      statusId: workspace.statuses[0].id, // Considering
      title: 'Email Blast',
      startDate: '2026-03-15',
      endDate: '2026-03-20',
      campaignId: campaign.id,
    });
    await createActivityViaAPI(page, {
      calendarId: workspace.calendar.id,
      swimlaneId: workspace.swimlane.id,
      statusId: workspace.statuses[1].id, // Negotiating
      title: 'Social Media Push',
      startDate: '2026-03-18',
      endDate: '2026-03-25',
    });
    await createActivityViaAPI(page, {
      calendarId: workspace.calendar.id,
      swimlaneId: workspace.swimlane.id,
      statusId: workspace.statuses[2].id, // Committed
      title: 'PR Release',
      startDate: '2026-03-20',
      endDate: '2026-03-22',
      campaignId: campaign.id,
    });

    await page.goto('/');
    await waitForAppLoad(page);
    await page.waitForTimeout(1000);

    // Use table view for easier text verification
    await page.getByRole('button', { name: 'Table' }).click();
    await page.waitForTimeout(500);
  });

  test('UJ-4.1: Can search activities by title', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search activities...');
    await searchInput.fill('Email');
    await page.waitForTimeout(500);

    await expect(page.getByText('Email Blast')).toBeVisible();
    await expect(page.getByText('Social Media Push')).not.toBeVisible();
    await expect(page.getByText('PR Release')).not.toBeVisible();
  });

  test('UJ-4.2: Can filter activities by campaign', async ({ page }) => {
    // Click the campaign filter
    await page.getByText('All Campaigns').click();
    await page.waitForTimeout(300);

    // Select Spring Campaign
    await page.getByRole('button', { name: 'Spring Campaign' }).click();
    await page.waitForTimeout(500);

    // Should show only campaign activities
    await expect(page.getByText('Email Blast')).toBeVisible();
    await expect(page.getByText('PR Release')).toBeVisible();
    await expect(page.getByText('Social Media Push')).not.toBeVisible();
  });

  test('UJ-4.3: Can filter activities by status', async ({ page }) => {
    // Click the status filter
    await page.getByText('All Statuses').click();
    await page.waitForTimeout(300);

    // Select the first status (Considering)
    const statusName = workspace.statuses[0].name;
    await page.locator('button').filter({ hasText: statusName }).last().click();
    await page.waitForTimeout(500);

    // Only Considering activities should show
    await expect(page.getByText('Email Blast')).toBeVisible();
    await expect(page.getByText('Social Media Push')).not.toBeVisible();
    await expect(page.getByText('PR Release')).not.toBeVisible();
  });

  test('UJ-4.4: Filters can be combined', async ({ page }) => {
    // Search for "Release"
    await page.getByPlaceholder('Search activities...').fill('Release');
    await page.waitForTimeout(300);

    // Also filter by campaign
    await page.getByText('All Campaigns').click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Spring Campaign' }).click();
    await page.waitForTimeout(500);

    // Only PR Release should match both filters
    await expect(page.getByText('PR Release')).toBeVisible();
    await expect(page.getByText('Email Blast')).not.toBeVisible();
    await expect(page.getByText('Social Media Push')).not.toBeVisible();
  });

  test('UJ-4.5: Clearing filters restores full activity list', async ({ page }) => {
    // Apply search filter
    const searchInput = page.getByPlaceholder('Search activities...');
    await searchInput.fill('Email');
    await page.waitForTimeout(500);

    // Only one visible
    await expect(page.getByText('Social Media Push')).not.toBeVisible();

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(500);

    // All should be visible again
    await expect(page.getByText('Email Blast')).toBeVisible();
    await expect(page.getByText('Social Media Push')).toBeVisible();
    await expect(page.getByText('PR Release')).toBeVisible();
  });
});
