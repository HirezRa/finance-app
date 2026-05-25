import { test, expect } from '@playwright/test';
import { gotoDashboard, mockDashboardApi, PARITY_SUMMARY, seedAuth } from './fixtures';

test.describe('Dashboard data parity', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
    await mockDashboardApi(page);
    await gotoDashboard(page);
  });

  test('desktop: displays API income and expenses totals', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'income/expenses tiles are desktop-only');

    const income = PARITY_SUMMARY.income.total.toLocaleString('en-US');
    const expenses = PARITY_SUMMARY.expenses.total.toLocaleString('en-US');

    await expect(page.getByText(`₪${income}`).first()).toBeVisible();
    await expect(page.getByText(`₪${expenses}`).first()).toBeVisible();
  });

  test('displays spendable from availableBalance', async ({ page }) => {
    const spendable = Math.round(PARITY_SUMMARY.availableBalance!).toLocaleString('en-US');
    await expect(page.getByText(`₪${spendable}`).first()).toBeVisible();
  });
});
