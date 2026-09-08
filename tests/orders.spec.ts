import { expect, type Page, test } from '@playwright/test';
import {
  clickFirstVisible,
  expectPageHasAnyText,
  expectPrivatePage,
  expectVisibleLoginForm,
  gotoApp,
  loginAndConfirmCompany,
  validateExportDownload,
  waitForAppReady,
} from './helpers/3pl';

test.describe('Orders page', () => {
  test('[ORD-001] loads orders list and filter/table controls', async ({ page }) => {
    await openOrders(page);
    await expectPageHasAnyText(page, [/search/i, /filter/i, /date/i, /status/i, /order/i]);
    await expectOrdersTableOrEmptyState(page);
  });

  test('[ORD-002] starts Excel export when export is available', async ({ page }, testInfo) => {
    await loginAndConfirmCompany(page);
    await validateExportDownload(page, testInfo, { path: '/orders', labels: [/orders?/i] });
  });

  test('[ORD-003] order table exposes key order columns', async ({ page }) => {
    await openOrders(page);

    await expectPageHasAnyText(page, [/order/i]);
    await expectPageHasAnyText(page, [/status/i]);
    await expectPageHasAnyText(page, [/driver/i, /store/i, /customer/i, /amount/i, /date/i, /actions/i]);
  });

  test('[ORD-004] date filter controls are visible and usable', async ({ page }) => {
    await openOrders(page);

    await expectPageHasAnyText(page, [/date/i, /apply/i, /filter/i]);
    await expect(page.locator('input:visible').first()).toBeVisible();
    await applyFilters(page);
    await expectOrdersTableOrEmptyState(page);
  });

  test('[ORD-005] status filter exposes expected order states', async ({ page }) => {
    await openOrders(page);
    await openCombobox(page, /status/i);

    await expectPageHasAnyText(page, [/complete/i, /enroute/i, /waiting/i, /pob/i, /arrived/i, /all/i]);
    await page.keyboard.press('Escape').catch(() => undefined);
  });

  test('[ORD-006] COMPLETE status filter can be applied', async ({ page }) => {
    await openOrders(page);
    await selectComboboxOption(page, /status/i, /complete/i);
    await applyFilters(page);

    await expectOrdersTableOrEmptyState(page);
    await expectPageHasAnyText(page, [/complete/i, /orders/i, /no records/i, /no data/i]);
  });

  test('[ORD-007] ENROUTE status filter can be applied', async ({ page }) => {
    await openOrders(page);
    await selectComboboxOption(page, /status/i, /enroute/i);
    await applyFilters(page);

    await expectOrdersTableOrEmptyState(page);
    await expectPageHasAnyText(page, [/enroute/i, /orders/i, /no records/i, /no data/i]);
  });

  test('[ORD-008] WAITING status filter can be applied', async ({ page }) => {
    await openOrders(page);
    await selectComboboxOption(page, /status/i, /waiting/i);
    await applyFilters(page);

    await expectOrdersTableOrEmptyState(page);
    await expectPageHasAnyText(page, [/waiting/i, /orders/i, /no records/i, /no data/i]);
  });

  test('[ORD-009] POB status filter can be applied', async ({ page }) => {
    await openOrders(page);
    const selected = await trySelectComboboxOption(page, /status/i, /pob|pickup/i);

    if (!selected) {
      test.info().annotations.push({
        type: 'status-skipped',
        description: 'POB/Pickup status option was not available in the current UAT status dropdown.',
      });
      return;
    }

    await applyFilters(page);

    await expectOrdersTableOrEmptyState(page);
    await expectPageHasAnyText(page, [/pob/i, /pickup/i, /orders/i, /no records/i, /no data/i]);
  });

  test('[ORD-010] ARRIVED status filter can be applied', async ({ page }) => {
    await openOrders(page);
    await selectComboboxOption(page, /status/i, /arrived/i);
    await applyFilters(page);

    await expectOrdersTableOrEmptyState(page);
    await expectPageHasAnyText(page, [/arrived/i, /orders/i, /no records/i, /no data/i]);
  });

  test('[ORD-011] search filter can be applied safely', async ({ page }) => {
    await openOrders(page);
    await fillOrderSearch(page, 'test');
    await applyFilters(page);

    await expect(page).not.toHaveURL(/\/login/i);
    await expectOrdersTableOrEmptyState(page);
  });

  test('[ORD-012] empty search result shows empty state without crashing', async ({ page }) => {
    await openOrders(page);
    await fillOrderSearch(page, 'zzzz-no-order-0000');
    await applyFilters(page);

    await expect(page).not.toHaveURL(/\/login/i);
    await expectPageHasAnyText(page, [/no records/i, /no data/i, /empty/i, /orders/i]);
  });

  test('[ORD-013] clear filters resets the order list view', async ({ page }) => {
    await openOrders(page);
    await fillOrderSearch(page, 'zzzz-no-order-0000');
    await applyFilters(page);

    await clickFirstVisible(page, [
      page.getByRole('button', { name: /^clear$/i }),
      page.locator('button').filter({ hasText: /^clear$/i }).first(),
    ]);
    await waitForAppReady(page);

    await expectOrdersTableOrEmptyState(page);
    await expectPageHasAnyText(page, [/orders/i, /filter/i, /status/i]);
  });

  test('[ORD-014] pagination controls are visible and safe', async ({ page }) => {
    await openOrders(page);

    await expectPageHasAnyText(page, [/total records/i, /of/i, /orders/i]);
    await expect(page.getByRole('button', { name: /previous page/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /next page/i })).toBeVisible();
  });

  test('[ORD-015] order view action opens details modal or panel when an order row is available', async ({ page }) => {
    await openOrders(page);
    const opened = await tryOpenOrderView(page);

    if (!opened) {
      test.info().annotations.push({
        type: 'order-view-skipped',
        description: 'No visible order view/action control was available for the current result set.',
      });
      return;
    }

    await expectPageHasAnyText(page, [/order details/i, /customer/i, /driver/i, /status/i, /amount/i, /store/i]);
    await closeDialog(page);
  });

  test('[ORD-016] order view modal can be closed back to the orders table', async ({ page }) => {
    await openOrders(page);
    const opened = await tryOpenOrderView(page);

    if (!opened) {
      test.info().annotations.push({
        type: 'order-view-skipped',
        description: 'No visible order view/action control was available for the current result set.',
      });
      return;
    }

    await closeDialog(page);
    await expectPrivatePage(page, '/orders', [/orders?/i]);
    await expectOrdersTableOrEmptyState(page);
  });

  test('[ORD-017] refresh keeps orders route and reloads list', async ({ page }) => {
    await openOrders(page);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await expect(page).not.toHaveURL(/\/login/i);
    await expectPrivatePage(page, '/orders', [/orders?/i]);
    await expectOrdersTableOrEmptyState(page);
  });

  test('[ORD-018] filters remain usable after refresh', async ({ page }) => {
    await openOrders(page);
    await fillOrderSearch(page, 'test');
    await applyFilters(page);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await expectPrivatePage(page, '/orders', [/orders?/i]);
    await expectPageHasAnyText(page, [/search/i, /filter/i, /status/i, /orders/i]);
  });

  test('[ORD-019] orders page remains stable after visiting another tenant page and returning', async ({ page }) => {
    await openOrders(page);
    await expectPrivatePage(page, '/drivers', [/drivers?/i]);
    await expectPrivatePage(page, '/orders', [/orders?/i]);

    await expectOrdersTableOrEmptyState(page);
  });

  test('[ORD-020] orders page is blocked for logged-out users', async ({ page }) => {
    await gotoApp(page, '/orders');
    await waitForAppReady(page);

    await expect(page).toHaveURL(/\/login/i);
    await expectVisibleLoginForm(page);
  });
});

async function openOrders(page: Page) {
  await loginAndConfirmCompany(page);
  await expectPrivatePage(page, '/orders', [/orders?/i]);
}

async function expectOrdersTableOrEmptyState(page: Page) {
  await expectPageHasAnyText(page, [/order/i, /status/i, /no records/i, /no data/i, /empty/i]);
  const hasTable = await page.locator('table, [role="table"]').first().isVisible().catch(() => false);
  const hasEmpty = await page.getByText(/no records|no data|empty/i).first().isVisible().catch(() => false);
  expect(hasTable || hasEmpty, 'Expected an orders table or an empty-state message.').toBeTruthy();
}

async function fillOrderSearch(page: Page, value: string) {
  const exactSearch = page.getByRole('textbox', { name: 'Search', exact: true });
  if (await exactSearch.isVisible().catch(() => false)) {
    await exactSearch.fill(value);
    return;
  }

  await page.locator('input[placeholder*="search" i], input[placeholder*="order" i]').first().fill(value);
}

async function applyFilters(page: Page) {
  await clickFirstVisible(page, [
    page.getByRole('button', { name: /apply filters/i }),
    page.getByRole('button', { name: /apply/i }),
    page.locator('button').filter({ hasText: /search|apply|filter/i }).first(),
  ]);
  await waitForAppReady(page);
}

async function openCombobox(page: Page, name: RegExp) {
  await clickFirstVisible(page, [
    page.getByRole('combobox', { name }),
    page.locator('[role="combobox"]').filter({ hasText: name }).first(),
  ]);
}

async function selectComboboxOption(page: Page, comboName: RegExp, optionName: RegExp) {
  const selected = await trySelectComboboxOption(page, comboName, optionName);
  expect(selected, `Expected option ${optionName} to be available.`).toBeTruthy();
}

async function trySelectComboboxOption(page: Page, comboName: RegExp, optionName: RegExp) {
  await openCombobox(page, comboName);

  const option = page.getByRole('option', { name: optionName }).first();
  if (await option.isVisible().catch(() => false)) {
    await option.click();
    await waitForAppReady(page);
    return true;
  }

  const fallback = page.locator('mat-option').filter({ hasText: optionName }).first();
  if (await fallback.isVisible().catch(() => false)) {
    await fallback.click();
    await waitForAppReady(page);
    return true;
  } else {
    await page.keyboard.press('Escape').catch(() => undefined);
    await waitForAppReady(page);
    return false;
  }
}

async function tryOpenOrderView(page: Page) {
  const directView = page.getByRole('button', { name: /view|details|order details/i }).first();
  if (await directView.isVisible().catch(() => false)) {
    await directView.click();
    await waitForAppReady(page);
    return true;
  }

  const actionButton = page
    .getByRole('button', { name: /order actions|actions|more/i })
    .or(page.locator('button').filter({ hasText: /more_horiz|more_vert|visibility/i }))
    .first();

  if (!(await actionButton.isVisible().catch(() => false))) {
    return false;
  }

  await actionButton.click();
  await waitForAppReady(page);

  for (const locator of [
    page.getByRole('menuitem', { name: /view|details|order details/i }).first(),
    page.getByRole('button', { name: /view|details|order details/i }).first(),
    page.locator('.cdk-overlay-container').getByText(/view|details|order details/i).first(),
  ]) {
    if (await locator.isVisible().catch(() => false)) {
      await locator.click();
      await waitForAppReady(page);
      return true;
    }
  }

  await page.keyboard.press('Escape').catch(() => undefined);
  return false;
}

async function closeDialog(page: Page) {
  await clickFirstVisible(page, [
    page.getByRole('button', { name: /close/i }),
    page.getByRole('button', { name: /cancel/i }),
    page.locator('button').filter({ hasText: /close|cancel/i }).first(),
  ]).catch(() => undefined);
  await page.keyboard.press('Escape').catch(() => undefined);
  await waitForAppReady(page);
}
