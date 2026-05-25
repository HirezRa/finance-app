import { expect, type Page, Route } from '@playwright/test';

/** Fixed API payload for data-parity assertions */
export const PARITY_SUMMARY = {
  month: 5,
  year: 2026,
  income: { total: 15000, fixed: 12000, variable: 3000 },
  expenses: { total: 8000, fixed: 5000, tracked: 2000, variable: 1000 },
  remaining: 7000,
  availableBalance: 7000,
  balance: 7000,
  monthlySavingsGoal: 1000,
  budgetCycleStartDay: 1,
  transactionCount: 42,
};

const AUTH_STORAGE = {
  state: {
    user: {
      id: 'e2e-user',
      email: 'e2e@example.com',
      name: 'בדיקות',
      role: 'user',
    },
    accessToken: 'e2e-test-token',
    refreshToken: null,
    isAuthenticated: true,
  },
  version: 0,
};

export async function seedAuth(page: Page) {
  await page.addInitScript((storage) => {
    window.localStorage.setItem('finance-auth', JSON.stringify(storage));
  }, AUTH_STORAGE);
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

/** Intercept dashboard-related API calls for isolated E2E */
export async function mockDashboardApi(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/dashboard/summary')) {
      return json(route, PARITY_SUMMARY);
    }
    if (url.includes('/dashboard/weekly')) {
      return json(route, [
        { week: 1, startDate: '2026-05-01', endDate: '2026-05-07', total: 2000 },
        { week: 2, startDate: '2026-05-08', endDate: '2026-05-14', total: 3000 },
      ]);
    }
    if (url.includes('/dashboard/categories')) {
      return json(route, [
        {
          categoryId: 'c1',
          name: 'Food',
          nameHe: 'אוכל',
          icon: '🍽',
          color: '#22c55e',
          total: 1200,
          count: 5,
          percentage: 15,
        },
      ]);
    }
    if (url.includes('/dashboard/recent')) {
      return json(route, [
        {
          id: 't1',
          date: '2026-05-20',
          amount: -50,
          description: 'בדיקה',
          category: { nameHe: 'אוכל', color: '#22c55e' },
        },
      ]);
    }
    if (url.includes('/dashboard/accounts')) {
      return json(route, {
        accounts: [
          {
            id: 'a1',
            institutionName: 'בנק',
            accountNumber: '123',
            balance: 5000,
          },
        ],
        totalBalance: 5000,
        count: 1,
      });
    }
    if (url.includes('/dashboard/history')) {
      return json(route, [{ month: 5, year: 2026, income: 15000, expenses: 8000, balance: 7000 }]);
    }
    if (url.includes('/auth/refresh') && method === 'POST') {
      return json(route, { accessToken: 'e2e-test-token', refreshToken: null });
    }
    if (url.includes('/version')) {
      return json(route, { version: '2.0.70-e2e', status: 'ok' });
    }
    if (url.includes('/settings') && method === 'GET') {
      return json(route, { budgetCycleStartDay: 1 });
    }
    if (url.includes('/transactions/installments-summary')) {
      return json(route, { activeCount: 0, totalMonthly: 0, totalRemaining: 0, details: [] });
    }
    if (url.includes('/categories/with-stats')) {
      return json(route, {
        categories: [
          {
            id: 'c1',
            nameHe: 'אוכל',
            monthlyTarget: 2000,
            spent: 1200,
            percentage: 60,
            over: false,
          },
        ],
      });
    }

    if (method === 'GET') {
      return json(route, []);
    }
    if (method === 'POST' || method === 'PATCH') {
      return json(route, { ok: true });
    }
    return route.continue();
  });
}

export async function gotoDashboard(page: Page) {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
  await expect(page.getByText('נשאר להוציא').first()).toBeVisible({ timeout: 25_000 });
}
