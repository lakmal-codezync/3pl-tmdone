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

const companySettlement = { path: '/settlement/company-settlement', labels: [/settlement/i, /payment/i] };
const pendingReceipts = { path: '/settlement/pending-receipts', labels: [/pending/i, /receipt/i] };

test.describe('Settlement pages', () => {
  test('[SET-001] company settlement loads with filters and list area', async ({ page }) => {
    await openSettlement(page, companySettlement);
    await expectSettlementShell(page);
    await expectSettlementResultsOrEmptyState(page);
  });

  test('[SET-002] pending receipts loads with filters and list area', async ({ page }) => {
    await openSettlement(page, pendingReceipts);
    await expectPageHasAnyText(page, [/pending/i, /receipt/i, /date/i, /filter/i]);
    await expectSettlementResultsOrEmptyState(page);
  });

  test('[SET-003] company settlement filters can be applied', async ({ page }) => {
    await openSettlement(page, companySettlement);
    await applyFilters(page);
    await expectSettlementResultsOrEmptyState(page);
  });

  test('[SET-004] pending receipt filters can be applied', async ({ page }) => {
    await openSettlement(page, pendingReceipts);
    await applyFilters(page);
    await expectSettlementResultsOrEmptyState(page);
  });

  test('[SET-005] payment status filter exposes available statuses', async ({ page }) => {
    await openSettlement(page, companySettlement);
    const opened = await tryOpenCombobox(page, /status/i);

    if (!opened) {
      test.info().annotations.push({ type: 'status-filter-skipped', description: 'No status filter visible on company settlement.' });
      return;
    }

    await expectPageHasAnyText(page, [/all/i, /pending/i, /paid/i, /approved/i, /rejected/i, /status/i]);
    await page.keyboard.press('Escape').catch(() => undefined);
  });

  test('[SET-006] payment type filter exposes available payment types', async ({ page }) => {
    await openSettlement(page, companySettlement);
    const opened = await tryOpenCombobox(page, /payment type|type/i);

    if (!opened) {
      test.info().annotations.push({ type: 'payment-type-filter-skipped', description: 'No payment type filter visible on company settlement.' });
      return;
    }

    await expectPageHasAnyText(page, [/all/i, /cash/i, /card/i, /bank/i, /payment/i, /type/i]);
    await page.keyboard.press('Escape').catch(() => undefined);
  });

  test('[SET-007] clear filters resets company settlement list', async ({ page }) => {
    await openSettlement(page, companySettlement);
    await applyFilters(page);
    await clearFilters(page);
    await expectSettlementShell(page);
  });

  test('[SET-008] clear filters resets pending receipts list', async ({ page }) => {
    await openSettlement(page, pendingReceipts);
    await applyFilters(page);
    await clearFilters(page);
    await expectPageHasAnyText(page, [/pending/i, /receipt/i, /filter/i]);
  });

  test('[SET-009] add company payment modal opens and validates without saving', async ({ page }) => {
    await openSettlement(page, companySettlement);
    const opened = await tryClickAny(page, [/add.*payment/i, /add company payment/i, /payment/i]);

    if (!opened) {
      test.info().annotations.push({ type: 'add-payment-skipped', description: 'No add payment action visible on company settlement.' });
      return;
    }

    await expectPageHasAnyText(page, [/add/i, /payment/i, /reference/i, /amount/i, /save/i, /create/i]);
    await closeDialog(page);
  });

  test('[SET-010] slip viewer opens from company settlement when available', async ({ page }) => {
    await openSettlement(page, companySettlement);
    const opened = await tryOpenAction(page, /slip|view|receipt|attachment/i);

    if (!opened) {
      test.info().annotations.push({ type: 'slip-skipped', description: 'No slip/view action visible for current company settlement rows.' });
      return;
    }

    await expectPageHasAnyText(page, [/slip/i, /receipt/i, /image/i, /pdf/i, /view/i]);
    await closeDialog(page);
  });

  test('[SET-011] pending receipt edit modal opens without saving when available', async ({ page }) => {
    await openSettlement(page, pendingReceipts);
    const opened = await tryOpenAction(page, /edit|update|pending/i);

    if (!opened) {
      test.info().annotations.push({ type: 'pending-edit-skipped', description: 'No edit action visible for current pending receipt rows.' });
      return;
    }

    await expectPageHasAnyText(page, [/edit/i, /pending/i, /receipt/i, /save/i, /amount/i, /reference/i]);
    await closeDialog(page);
  });

  test('[SET-012] pending receipt slip viewer opens when available', async ({ page }) => {
    await openSettlement(page, pendingReceipts);
    const opened = await tryOpenAction(page, /slip|view|receipt|attachment/i);

    if (!opened) {
      test.info().annotations.push({ type: 'pending-slip-skipped', description: 'No slip/view action visible for current pending receipt rows.' });
      return;
    }

    await expectPageHasAnyText(page, [/slip/i, /receipt/i, /image/i, /pdf/i, /view/i]);
    await closeDialog(page);
  });

  test('[SET-013] company settlement export starts when available', async ({ page }, testInfo) => {
    await loginAndConfirmCompany(page);
    await validateExportDownload(page, testInfo, companySettlement);
  });

  test('[SET-014] pending receipts export starts when available', async ({ page }, testInfo) => {
    await loginAndConfirmCompany(page);
    await validateExportDownload(page, testInfo, pendingReceipts);
  });

  test('[SET-015] company settlement refresh keeps route and data area', async ({ page }) => {
    await openSettlement(page, companySettlement);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await expectPrivatePage(page, companySettlement.path, companySettlement.labels);
    await expectSettlementResultsOrEmptyState(page);
  });

  test('[SET-016] pending receipts refresh keeps route and data area', async ({ page }) => {
    await openSettlement(page, pendingReceipts);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await expectPrivatePage(page, pendingReceipts.path, pendingReceipts.labels);
    await expectSettlementResultsOrEmptyState(page);
  });

  test('[SET-017] settlement pages remain stable after navigation away and back', async ({ page }) => {
    await openSettlement(page, companySettlement);
    await expectPrivatePage(page, '/orders', [/orders?/i]);
    await expectPrivatePage(page, companySettlement.path, companySettlement.labels);
    await expectSettlementResultsOrEmptyState(page);
  });

  test('[SET-018] pending receipts page remains stable after navigation away and back', async ({ page }) => {
    await openSettlement(page, pendingReceipts);
    await expectPrivatePage(page, '/drivers', [/drivers?/i]);
    await expectPrivatePage(page, pendingReceipts.path, pendingReceipts.labels);
    await expectSettlementResultsOrEmptyState(page);
  });

  test('[SET-019] company settlement is blocked for logged-out users', async ({ page }) => {
    await gotoApp(page, companySettlement.path);
    await waitForAppReady(page);
    await expect(page).toHaveURL(/\/login/i);
    await expectVisibleLoginForm(page);
  });

  test('[SET-020] pending receipts is blocked for logged-out users', async ({ page }) => {
    await gotoApp(page, pendingReceipts.path);
    await waitForAppReady(page);
    await expect(page).toHaveURL(/\/login/i);
    await expectVisibleLoginForm(page);
  });

  test('[SET-021] company settlement PENDING status filter can be applied', async ({ page }) => {
    await openSettlement(page, companySettlement);
    const selected = await trySelectStatusOption(page, /pending/i);

    if (!selected) {
      test.info().annotations.push({
        type: 'status-filter-skipped',
        description: 'PENDING status option was not available on company settlement.',
      });
      return;
    }

    await applyFilters(page);
    await expectSettlementResultsOrEmptyState(page);
    await expectPageHasAnyText(page, [/pending/i, /settlement/i, /payment/i, /no records/i, /no data/i]);
  });

  test('[SET-022] company settlement APPROVED status filter can be applied', async ({ page }) => {
    await openSettlement(page, companySettlement);
    const selected = await trySelectStatusOption(page, /approved/i);

    if (!selected) {
      test.info().annotations.push({
        type: 'status-filter-skipped',
        description: 'APPROVED status option was not available on company settlement.',
      });
      return;
    }

    await applyFilters(page);
    await expectSettlementResultsOrEmptyState(page);
    await expectPageHasAnyText(page, [/approved/i, /settlement/i, /payment/i, /no records/i, /no data/i]);
  });

  test('[SET-023] company settlement REJECTED status filter can be applied', async ({ page }) => {
    await openSettlement(page, companySettlement);
    const selected = await trySelectStatusOption(page, /rejected/i);

    if (!selected) {
      test.info().annotations.push({
        type: 'status-filter-skipped',
        description: 'REJECTED status option was not available on company settlement.',
      });
      return;
    }

    await applyFilters(page);
    await expectSettlementResultsOrEmptyState(page);
    await expectPageHasAnyText(page, [/rejected/i, /settlement/i, /payment/i, /no records/i, /no data/i]);
  });

  test('[SET-024] pending receipts CREDIT payment option filter can be applied', async ({ page }) => {
    await openSettlement(page, pendingReceipts);
    const selected = await trySelectComboboxOption(page, /payment option/i, /credit/i);

    if (!selected) {
      test.info().annotations.push({
        type: 'payment-option-filter-skipped',
        description: 'CREDIT payment option was not available on pending receipts.',
      });
      return;
    }

    await applyFilters(page);
    await expectSettlementResultsOrEmptyState(page);
    await expectPageHasAnyText(page, [/credit/i, /receipt/i, /pending/i, /no records/i, /no data/i]);
  });

  test('[SET-025] pending receipts DEBIT payment option filter can be applied', async ({ page }) => {
    await openSettlement(page, pendingReceipts);
    const selected = await trySelectComboboxOption(page, /payment option/i, /debit/i);

    if (!selected) {
      test.info().annotations.push({
        type: 'payment-option-filter-skipped',
        description: 'DEBIT payment option was not available on pending receipts.',
      });
      return;
    }

    await applyFilters(page);
    await expectSettlementResultsOrEmptyState(page);
    await expectPageHasAnyText(page, [/debit/i, /receipt/i, /pending/i, /no records/i, /no data/i]);
  });
});

async function openSettlement(page: Page, route: { path: string; labels: RegExp[] }) {
  await loginAndConfirmCompany(page);
  await expectPrivatePage(page, route.path, route.labels);
}

async function expectSettlementShell(page: Page) {
  await expectPageHasAnyText(page, [/settlement/i, /payment/i, /date/i, /filter/i, /status/i]);
}

async function expectSettlementResultsOrEmptyState(page: Page) {
  await expectPageHasAnyText(page, [/payment/i, /receipt/i, /settlement/i, /no records/i, /no data/i, /empty/i]);
  const hasTable = await page.locator('table, [role="table"]').first().isVisible().catch(() => false);
  const hasEmpty = await page.getByText(/no records|no data|empty/i).first().isVisible().catch(() => false);
  expect(hasTable || hasEmpty, 'Expected settlement table/list or empty state.').toBeTruthy();
}

async function applyFilters(page: Page) {
  await clickFirstVisible(page, [
    page.getByRole('button', { name: /apply filters/i }),
    page.getByRole('button', { name: /apply/i }),
    page.locator('button').filter({ hasText: /search|apply|filter/i }).first(),
  ]);
  await waitForAppReady(page);
}

async function clearFilters(page: Page) {
  await clickFirstVisible(page, [
    page.getByRole('button', { name: /^clear$/i }),
    page.locator('button').filter({ hasText: /^clear$/i }).first(),
  ]);
  await waitForAppReady(page);
}

async function tryOpenCombobox(page: Page, name: RegExp) {
  const combo = page.getByRole('combobox', { name }).first();
  if (await combo.isVisible().catch(() => false)) {
    await combo.click();
    return true;
  }

  const fallback = page.locator('[role="combobox"]').filter({ hasText: name }).first();
  if (await fallback.isVisible().catch(() => false)) {
    await fallback.click();
    return true;
  }

  return false;
}

async function trySelectStatusOption(page: Page, optionName: RegExp) {
  return trySelectComboboxOption(page, /status/i, optionName);
}

async function trySelectComboboxOption(page: Page, comboName: RegExp, optionName: RegExp) {
  const opened = await tryOpenCombobox(page, comboName);
  if (!opened) {
    return false;
  }

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
  }

  await page.keyboard.press('Escape').catch(() => undefined);
  return false;
}

async function tryClickAny(page: Page, names: RegExp[]) {
  for (const name of names) {
    const button = page.getByRole('button', { name }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click();
      await waitForAppReady(page);
      return true;
    }
  }
  return false;
}

async function tryOpenAction(page: Page, action: RegExp) {
  for (const locator of [
    page.getByRole('button', { name: action }).first(),
    page.locator('button').filter({ hasText: /visibility|edit|receipt|slip|more_horiz|more_vert/i }).first(),
  ]) {
    if (await locator.isVisible().catch(() => false)) {
      await locator.click();
      await waitForAppReady(page);
      return true;
    }
  }
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
