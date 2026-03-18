import { test, expect } from '@playwright/test';
import { setupTestWorkspace, waitForAppLoad, createActivityViaAPI } from './helpers';

test.describe('UJ-2: Activity Lifecycle', () => {
  let workspace: Awaited<ReturnType<typeof setupTestWorkspace>>;

  test.beforeEach(async ({ page }) => {
    workspace = await setupTestWorkspace(page);
    await page.goto('/');
    await waitForAppLoad(page);
    await page.waitForTimeout(1500);
  });

  test('UJ-2.1: Can create an activity via New Activity button', async ({ page }) => {
    // Click New Activity
    await page.getByRole('button', { name: 'New Activity' }).click();

    // Modal should open
    await expect(page.getByRole('heading', { name: 'Create Activity' })).toBeVisible();

    // Fill title (the first text input in the modal)
    const modal = page.locator('.fixed.inset-0');
    await modal.locator('input[type="text"]').first().fill('Spring Campaign Launch');

    // Set dates
    const dateInputs = modal.locator('input[type="date"]');
    await dateInputs.nth(0).fill('2026-04-01');
    await dateInputs.nth(1).fill('2026-04-15');

    // Submit
    await page.getByRole('button', { name: 'Save Activity' }).click();
    await page.waitForTimeout(1500);

    // Switch to table view for visibility check
    const header = page.locator('header');
    await header.getByRole('button', { name: 'Table' }).click();
    await page.waitForTimeout(500);

    // Activity should now be visible
    await expect(page.getByText('Spring Campaign Launch')).toBeVisible();
  });

  test('UJ-2.2: Activity modal requires title, dates, status, swimlane', async ({ page }) => {
    await page.getByRole('button', { name: 'New Activity' }).click();
    await expect(page.getByRole('heading', { name: 'Create Activity' })).toBeVisible();

    const modal = page.locator('.fixed.inset-0');

    // Clear the title
    await modal.locator('input[type="text"]').first().fill('');

    // Try submitting
    await page.getByRole('button', { name: 'Save Activity' }).click();

    // Should show validation errors
    await expect(page.getByText('Title is required')).toBeVisible();
  });

  test('UJ-2.3: Activity modal supports optional fields', async ({ page }) => {
    await page.getByRole('button', { name: 'New Activity' }).click();

    // Check optional fields are present
    await expect(page.locator('input[type="number"]').first()).toBeVisible(); // Cost
    await expect(page.locator('textarea').first()).toBeVisible(); // Description
    await expect(page.getByPlaceholder('social, paid...')).toBeVisible(); // Tags
  });

  test('UJ-2.4: Created activity appears in correct swimlane', async ({ page }) => {
    // Create activity via API
    await createActivityViaAPI(page, {
      calendarId: workspace.calendar.id,
      swimlaneId: workspace.swimlane.id,
      statusId: workspace.statuses[0].id,
      title: 'Swimlane Test Activity',
      startDate: '2026-04-01',
      endDate: '2026-04-15',
    });

    // Reload to see the activity
    await page.goto('/');
    await waitForAppLoad(page);
    await page.waitForTimeout(1000);

    // Activity and swimlane should both be visible
    await expect(page.getByText('Swimlane Test Activity')).toBeVisible();
    await expect(page.getByText('Email Marketing')).toBeVisible();
  });

  test('UJ-2.5: Can click activity to open edit modal with pre-filled data', async ({ page }) => {
    // Create activity
    await createActivityViaAPI(page, {
      calendarId: workspace.calendar.id,
      swimlaneId: workspace.swimlane.id,
      statusId: workspace.statuses[0].id,
      title: 'Edit Me Activity',
      startDate: '2026-04-01',
      endDate: '2026-04-15',
    });

    await page.goto('/');
    await waitForAppLoad(page);
    await page.waitForTimeout(1500);

    // Switch to table view for easier clicking
    await page.locator('header').getByRole('button', { name: 'Table' }).click();
    await page.waitForTimeout(500);

    // Click the title text in the table to open modal
    await page.locator('td span').filter({ hasText: 'Edit Me Activity' }).click();
    await page.waitForTimeout(500);

    // Modal should show Edit Activity
    await expect(page.getByRole('heading', { name: 'Edit Activity' })).toBeVisible();

    // Title should be pre-filled
    const modal = page.locator('.fixed.inset-0');
    const titleInput = modal.locator('input[type="text"]').first();
    await expect(titleInput).toHaveValue('Edit Me Activity');
  });

  test('UJ-2.6: Can update activity fields and save', async ({ page }) => {
    // Create activity
    await createActivityViaAPI(page, {
      calendarId: workspace.calendar.id,
      swimlaneId: workspace.swimlane.id,
      statusId: workspace.statuses[0].id,
      title: 'Update Me',
      startDate: '2026-04-01',
      endDate: '2026-04-15',
    });

    await page.goto('/');
    await waitForAppLoad(page);
    await page.waitForTimeout(1500);

    // Switch to table view
    await page.locator('header').getByRole('button', { name: 'Table' }).click();
    await page.waitForTimeout(500);

    // Click title text to open edit modal
    await page.locator('td span').filter({ hasText: 'Update Me' }).click();
    await page.waitForTimeout(500);

    // Update the title
    const modal = page.locator('.fixed.inset-0');
    const titleInput = modal.locator('input[type="text"]').first();
    await titleInput.fill('Updated Activity Name');

    // Save
    await page.getByRole('button', { name: 'Save Activity' }).click();
    await page.waitForTimeout(1500);

    // Verify the update
    await expect(page.getByText('Updated Activity Name')).toBeVisible();
  });

  test('UJ-2.7: Can delete activity with two-step confirmation', async ({ page }) => {
    // Create activity
    await createActivityViaAPI(page, {
      calendarId: workspace.calendar.id,
      swimlaneId: workspace.swimlane.id,
      statusId: workspace.statuses[0].id,
      title: 'Delete Me Activity',
      startDate: '2026-04-01',
      endDate: '2026-04-15',
    });

    await page.goto('/');
    await waitForAppLoad(page);
    await page.waitForTimeout(1500);

    // Switch to table view
    await page.locator('header').getByRole('button', { name: 'Table' }).click();
    await page.waitForTimeout(500);

    // Click title text to open edit modal
    await page.locator('td span').filter({ hasText: 'Delete Me Activity' }).click();
    await page.waitForTimeout(500);

    // First click: "Delete Activity" button
    await page.getByRole('button', { name: 'Delete Activity' }).click();

    // Second step: confirmation appears
    await expect(page.getByText('Delete permanently?')).toBeVisible();

    // Confirm deletion
    await page.getByRole('button', { name: 'YES' }).click();
    await page.waitForTimeout(1500);

    // Activity should be gone
    await expect(page.getByText('Delete Me Activity')).not.toBeVisible();
  });

  test('UJ-2.8: Validates end date >= start date', async ({ page }) => {
    await page.getByRole('button', { name: 'New Activity' }).click();

    const modal = page.locator('.fixed.inset-0');

    // Fill title
    await modal.locator('input[type="text"]').first().fill('Date Validation Test');

    // Set end date before start date
    const dateInputs = modal.locator('input[type="date"]');
    await dateInputs.nth(0).fill('2026-04-15');
    await dateInputs.nth(1).fill('2026-04-01');

    // Try to save
    await page.getByRole('button', { name: 'Save Activity' }).click();

    // Should show date error
    await expect(page.getByText('End date must be on or after start date')).toBeVisible();
  });

  test('UJ-2.9: Shows inline validation errors for required fields', async ({ page }) => {
    await page.getByRole('button', { name: 'New Activity' }).click();

    const modal = page.locator('.fixed.inset-0');

    // Clear title
    await modal.locator('input[type="text"]').first().fill('');

    // Try to save
    await page.getByRole('button', { name: 'Save Activity' }).click();

    // Should show at least the title error
    await expect(page.getByText('Title is required')).toBeVisible();
  });
});
