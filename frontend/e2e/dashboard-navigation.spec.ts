import { test, expect } from '@playwright/test';
import { gotoDashboard, mockDashboardApi, seedAuth } from './fixtures';

test.describe('Dashboard navigation (web + mobile)', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
    await mockDashboardApi(page);
    await gotoDashboard(page);
  });

  test('desktop: header nav reaches transactions and settings via sidebar', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop-chrome', 'desktop header nav');

    await page.getByRole('navigation', { name: 'ניווט ראשי' }).getByRole('link', { name: 'Transactions' }).click();
    await expect(page).toHaveURL(/\/transactions/);

    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'הגדרות' }).first().click();
    await expect(page).toHaveURL(/\/settings/);
  });

  test('mobile: bottom nav includes categories and settings', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile-chrome', 'mobile bottom nav');

    const bottomNav = page.getByRole('navigation', { name: 'ניווט ראשי' });
    await bottomNav.getByRole('link', { name: 'קטגוריות' }).click();
    await expect(page).toHaveURL(/\/categories/);

    await page.goto('/dashboard');
    await bottomNav.getByRole('link', { name: 'הגדרות' }).click();
    await expect(page).toHaveURL(/\/settings/);
  });

  test('mobile: quick action navigates to budgets', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile-chrome', 'brutal quick actions');

    await page.getByRole('button', { name: 'תקציב' }).click();
    await expect(page).toHaveURL(/\/budgets/);
  });
});
