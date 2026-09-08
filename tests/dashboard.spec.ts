import { expect, test } from '@playwright/test';
import { clickFirstVisible, expectPageHasAnyText, expectPrivatePage, gotoApp, loginAndConfirmCompany, waitForAppReady } from './helpers/3pl';

test.describe('Dashboard page', () => {
  test('[DASH-001] loads dashboard page shell with company context', async ({ page }) => {
    await loginAndConfirmCompany(page);
    await expectPrivatePage(page, '/dashboard', [/dashboard/i, /registered drivers/i, /completed orders/i]);
    await expectPageHasAnyText(page, [/sign out/i, /drivers/i, /orders/i, /reports/i]);
  });

  test('[DASH-002] shows all expected dashboard KPI cards', async ({ page }) => {
    await loginAndConfirmCompany(page);
    await expectPrivatePage(page, '/dashboard');

    await expectPageHasAnyText(page, [/registered drivers/i]);
    await expectPageHasAnyText(page, [/approved drivers/i]);
    await expectPageHasAnyText(page, [/pending drivers/i]);
    await expectPageHasAnyText(page, [/completed orders/i]);
    await expectPageHasAnyText(page, [/driver no show/i]);
    await expectPageHasAnyText(page, [/online drivers/i]);
    await expectPageHasAnyText(page, [/offline drivers/i]);
  });

  test('[DASH-003] KPI cards display numeric values or clear error state', async ({ page }) => {
    await loginAndConfirmCompany(page);
    await expectPrivatePage(page, '/dashboard');

    for (const label of [
      /registered drivers/i,
      /approved drivers/i,
      /pending drivers/i,
      /completed orders/i,
      /driver no show/i,
      /online drivers/i,
      /offline drivers/i,
    ]) {
      await expectDashboardMetric(page, label);
    }
  });

  test('[DASH-004] average delivery time chart section renders', async ({ page }) => {
    await loginAndConfirmCompany(page);
    await expectPrivatePage(page, '/dashboard');

    await expectPageHasAnyText(page, [/pending drivers/i, /online drivers/i, /offline drivers/i, /average delivery/i]);
    await expect(
      page.locator('apx-chart, canvas, svg').first(),
      'Expected a chart, canvas, or svg visual to be present on the dashboard.',
    ).toBeVisible();
  });

  test('[DASH-005] date range filter controls are available', async ({ page }) => {
    await loginAndConfirmCompany(page);
    await expectPrivatePage(page, '/dashboard');

    await expectPageHasAnyText(page, [/date/i, /apply/i, /filter/i]);
    await expect(
      page.locator('input:visible, [role="combobox"]:visible').first(),
      'Expected at least one visible dashboard filter input.',
    ).toBeVisible();
  });

  test('[DASH-006] applying dashboard filters keeps the user on dashboard with KPI data visible', async ({ page }) => {
    await loginAndConfirmCompany(page);
    await expectPrivatePage(page, '/dashboard');

    await clickFirstVisible(page, [
      page.getByRole('button', { name: /apply/i }),
      page.getByRole('button', { name: /filter/i }),
      page.locator('button').filter({ hasText: /search|apply|filter/i }).first(),
    ]);
    await waitForAppReady(page);

    await expect(page).not.toHaveURL(/\/login/i);
    await expectPageHasAnyText(page, [/registered drivers/i, /completed orders/i, /average delivery/i]);
  });

  test('[DASH-007] completed orders KPI navigates to Orders workflow', async ({ page }) => {
    await loginAndConfirmCompany(page);
    await expectPrivatePage(page, '/dashboard');

    await clickFirstVisible(page, [
      page.getByText(/completed orders/i),
    ]);

    await page.waitForLoadState('domcontentloaded');
    await waitForAppReady(page);
    await expect(page).not.toHaveURL(/\/login/i);
    await expectPageHasAnyText(page, [/orders/i, /order/i, /completed/i]);
  });

  test('[DASH-008] driver KPI navigates to Drivers workflow', async ({ page }) => {
    await loginAndConfirmCompany(page);
    await expectPrivatePage(page, '/dashboard');

    await clickFirstVisible(page, [
      page.getByText(/pending drivers/i),
      page.getByText(/approved drivers/i),
      page.getByText(/registered drivers/i),
    ]);

    await page.waitForLoadState('domcontentloaded');
    await waitForAppReady(page);
    await expect(page).not.toHaveURL(/\/login/i);
    await expectPageHasAnyText(page, [/drivers/i, /driver/i, /approval/i]);
  });

  test('[DASH-009] refresh keeps dashboard session and reloads data', async ({ page }) => {
    await loginAndConfirmCompany(page);
    await expectPrivatePage(page, '/dashboard');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await expect(page).not.toHaveURL(/\/login/i);
    await expectPageHasAnyText(page, [/dashboard/i, /registered drivers/i, /completed orders/i]);
  });

  test('[DASH-010] dashboard is blocked for logged-out users', async ({ page }) => {
    await gotoApp(page, '/dashboard');
    await waitForAppReady(page);

    await expect(page).toHaveURL(/\/login/i);
    await expectPageHasAnyText(page, [/username/i, /password/i, /login/i]);
  });

  test('[DASH-011] dashboard route remains stable after moving away and returning', async ({ page }) => {
    await loginAndConfirmCompany(page);
    await expectPrivatePage(page, '/orders', [/orders?/i]);
    await expectPrivatePage(page, '/dashboard', [/dashboard/i, /registered drivers/i, /completed orders/i]);

    await expectPageHasAnyText(page, [/average delivery/i, /online drivers/i, /offline drivers/i]);
  });

  test('[DASH-012] dashboard displays selected company context', async ({ page }) => {
    await loginAndConfirmCompany(page);
    await expectPrivatePage(page, '/dashboard');

    await expectPageHasAnyText(page, [/quick delivers/i, /company/i, /dashboard/i]);
  });

  test('[DASH-013] dashboard filter state survives refresh after applying filters', async ({ page }) => {
    await loginAndConfirmCompany(page);
    await expectPrivatePage(page, '/dashboard');

    const inputsBefore = await page.locator('input:visible').evaluateAll((inputs) =>
      inputs.map((input) => (input as HTMLInputElement).value).filter(Boolean),
    );

    await clickFirstVisible(page, [
      page.getByRole('button', { name: /apply/i }),
      page.getByRole('button', { name: /filter/i }),
      page.locator('button').filter({ hasText: /search|apply|filter/i }).first(),
    ]);
    await waitForAppReady(page);

    const urlAfterApply = page.url();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await expectPageHasAnyText(page, [/dashboard/i, /registered drivers/i, /completed orders/i]);

    const inputsAfter = await page.locator('input:visible').evaluateAll((inputs) =>
      inputs.map((input) => (input as HTMLInputElement).value).filter(Boolean),
    );

    if (inputsBefore.length > 0) {
      expect(inputsAfter).toEqual(expect.arrayContaining(inputsBefore));
    }
    expect(page.url()).toBe(urlAfterApply);
  });

  test('[DASH-014] chart API failure does not blank the dashboard KPI cards', async ({ page }) => {
    await page.route('**/api/home/getAverageDeliveryTimeToChart**', (route) => route.abort());

    await loginAndConfirmCompany(page);
    await expectPrivatePage(page, '/dashboard');

    await expectDashboardMetric(page, /registered drivers/i);
    await expectDashboardMetric(page, /approved drivers/i);
    await expectDashboardMetric(page, /completed orders/i);
    await expectPageHasAnyText(page, [/average delivery/i, /error/i, /failed/i, /could not load/i]);
  });

  test('[DASH-015] dashboard primary navigation links remain available from the page', async ({ page }) => {
    await loginAndConfirmCompany(page);
    await expectPrivatePage(page, '/dashboard');

    await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /drivers/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /orders/i })).toBeVisible();
    await expectPageHasAnyText(page, [/reports/i, /settlement/i, /bird eye view/i]);
  });
});

async function expectDashboardMetric(page: import('@playwright/test').Page, label: RegExp) {
  const metric = page
    .locator('article, mat-card, button, section, div')
    .filter({ hasText: label })
    .filter({ hasText: /\d+|error|failed|could not load|-/i })
    .first();

  await expect(metric, `Expected metric card for ${label} to show a number or clear error state.`).toBeVisible();
}
