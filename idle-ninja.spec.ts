import { test, expect } from '@playwright/test';

test.describe('IdleNinja E2E', () => {
  test('should show warning and then logout when inactive', async ({
    page,
  }) => {
    await page.goto('/');

    // Wait for the warning threshold (2 seconds)
    await expect(page.locator('#status')).toHaveText('Status: Idle Warning', {
      timeout: 3000,
    });

    // Wait for the logout threshold (4 seconds)
    await expect(page.locator('#main-heading')).toHaveText(
      'You have been logged out due to inactivity.',
      { timeout: 3000 },
    );
  });

  test('should reset timer on user activity', async ({ page }) => {
    await page.goto('/');

    // Wait for the warning
    await expect(page.locator('#status')).toHaveText('Status: Idle Warning', {
      timeout: 3000,
    });

    // Simulate user activity (moving the mouse)
    await page.mouse.move(100, 100);

    // Verify the status resets to active
    await expect(page.locator('#status')).toHaveText('Status: Active');
  });

  test('multi-tab leader election utilizes localStorage', async ({
    context,
  }) => {
    // Open two tabs in the same browser context
    const page1 = await context.newPage();
    await page1.goto('/');

    const page2 = await context.newPage();
    await page2.goto('/');

    // Wait a brief moment for the initial leader election check to pass
    await page1.waitForTimeout(500);

    const leaderData = await page1.evaluate(() =>
      localStorage.getItem('idle-ninja-leader'),
    );
    expect(leaderData).not.toBeNull();
  });
});
