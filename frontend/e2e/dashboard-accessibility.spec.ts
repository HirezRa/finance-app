import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { gotoDashboard, mockDashboardApi, seedAuth } from './fixtures';

test.describe('Dashboard accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
    await mockDashboardApi(page);
    await gotoDashboard(page);
    await page.waitForTimeout(300);
  });

  for (const project of ['desktop-chrome', 'mobile-chrome'] as const) {
    test(`${project}: no critical axe violations on dashboard`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== project, project);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .disableRules(['color-contrast'])
        .analyze();

      const critical = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
      expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
    });
  }

  test('desktop: period controls are keyboard-focusable', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'desktop only');

    const prev = page.getByRole('button', { name: 'מחזור קודם' });
    await prev.focus();
    await expect(prev).toBeFocused();
  });
});
