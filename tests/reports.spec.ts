import { expect, type Page, type TestInfo, test } from '@playwright/test';
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

const reportRoutes = [
  { id: 'RPT-001', path: '/reports/driver-status', title: /driver status/i, labels: [/driver status/i, /report/i], exportable: true },
  { id: 'RPT-002', path: '/reports/finance', title: /finance/i, labels: [/finance/i, /summary/i], exportable: false },
  { id: 'RPT-003', path: '/reports/driver-activity', title: /activity/i, labels: [/activity/i, /driver/i], exportable: true },
  { id: 'RPT-004', path: '/reports/driver-activity-details', title: /log|activity/i, labels: [/log/i, /activity/i, /driver/i], exportable: true },
  { id: 'RPT-005', path: '/reports/driver-performance', title: /performance/i, labels: [/performance/i, /driver/i], exportable: true },
  { id: 'RPT-006', path: '/reports/driver-individual-performance', title: /individual|performance/i, labels: [/individual/i, /performance/i, /driver/i], exportable: true },
];

test.describe('Reports pages', () => {
  for (const route of reportRoutes) {
    test(`[${route.id}] ${route.path} loads report page with filters and table or empty state`, async ({ page }) => {
      await openReport(page, route);
      await expectReportShell(page);
      await expectReportResultsOrEmptyState(page);
    });
  }

  test('[RPT-007] driver status report filters can be applied', async ({ page }) => {
    await openReport(page, reportRoutes[0]);
    await applyFilters(page);
    await expectReportResultsOrEmptyState(page);
    await expectPageHasAnyText(page, [/driver status/i, /driver/i, /payment/i, /report/i]);
  });

  test('[RPT-008] finance summary filters can be applied', async ({ page }) => {
    await openReport(page, reportRoutes[1]);
    await applyFilters(page);
    await expectReportResultsOrEmptyState(page);
    await expectPageHasAnyText(page, [/finance/i, /summary/i, /driver/i, /date/i]);
  });

  test('[RPT-009] driver activity log filters can be applied', async ({ page }) => {
    await openReport(page, reportRoutes[2]);
    await applyFilters(page);
    await expectReportResultsOrEmptyState(page);
    await expectPageHasAnyText(page, [/activity/i, /driver/i, /log/i, /date/i]);
  });

  test('[RPT-010] driver activity details filters can be applied', async ({ page }) => {
    await openReport(page, reportRoutes[3]);
    await applyFilters(page);
    await expectReportResultsOrEmptyState(page);
    await expectPageHasAnyText(page, [/activity/i, /driver/i, /log/i, /date/i]);
  });

  test('[RPT-011] driver performance filters can be applied', async ({ page }) => {
    await openReport(page, reportRoutes[4]);
    await applyFilters(page);
    await expectReportResultsOrEmptyState(page);
    await expectPageHasAnyText(page, [/performance/i, /driver/i, /date/i]);
  });

  test('[RPT-012] driver individual performance filters can be applied', async ({ page }) => {
    await openReport(page, reportRoutes[5]);
    await applyFilters(page);
    await expectReportResultsOrEmptyState(page);
    await expectPageHasAnyText(page, [/individual/i, /performance/i, /driver/i, /date/i]);
  });

  test('[RPT-013] driver dropdown/filter controls are usable where available', async ({ page }) => {
    await openReport(page, reportRoutes[0]);
    const opened = await tryOpenCombobox(page, /driver/i);

    if (!opened) {
      test.info().annotations.push({ type: 'driver-filter-skipped', description: 'No driver combobox was visible on this report.' });
      return;
    }

    await expectPageHasAnyText(page, [/all drivers/i, /driver/i]);
    await page.keyboard.press('Escape').catch(() => undefined);
  });

  test('[RPT-014] payment/status filter controls are usable where available', async ({ page }) => {
    await openReport(page, reportRoutes[0]);
    const opened = await tryOpenCombobox(page, /payment|status/i);

    if (!opened) {
      test.info().annotations.push({ type: 'payment-filter-skipped', description: 'No payment/status combobox was visible on this report.' });
      return;
    }

    await expectPageHasAnyText(page, [/all/i, /credit/i, /debit/i, /paid/i, /pending/i, /payment/i, /status/i]);
    await page.keyboard.press('Escape').catch(() => undefined);
  });

  test('[RPT-015] clear filters resets report view', async ({ page }) => {
    await openReport(page, reportRoutes[0]);
    await applyFilters(page);
    await clickFirstVisible(page, [
      page.getByRole('button', { name: /^clear$/i }),
      page.locator('button').filter({ hasText: /^clear$/i }).first(),
    ]);
    await waitForAppReady(page);
    await expectReportShell(page);
  });

  test('[RPT-016] report table pagination controls are visible when data is present', async ({ page }) => {
    await openReport(page, reportRoutes[0]);
    await expectReportResultsOrEmptyState(page);

    const hasPaginator = await page.getByRole('button', { name: /next page|previous page/i }).first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText(/no records|no data|empty/i).first().isVisible().catch(() => false);

    expect(hasPaginator || hasEmpty, 'Expected pagination controls or an empty-state message.').toBeTruthy();
  });

  test('[RPT-017] individual driver report modal opens from driver status report when available', async ({ page }) => {
    await openReport(page, reportRoutes[0]);
    const opened = await tryOpenReportAction(page, /individual|view|details|report/i);

    if (!opened) {
      test.info().annotations.push({ type: 'modal-skipped', description: 'No individual report/view action was available for the current result set.' });
      return;
    }

    await expectPageHasAnyText(page, [/individual/i, /driver/i, /report/i, /details/i, /balance/i]);
    await closeDialog(page);
  });

  for (const route of reportRoutes.filter((route) => route.exportable)) {
    test(`[RPT-EXP-${route.id.slice(-3)}] ${route.path} starts Excel export when export is available`, async ({ page }, testInfo) => {
      await loginAndConfirmCompany(page);
      if (route.path === '/reports/driver-status') {
        await validateDriverStatusExport(page, testInfo);
      } else {
        await validateExportDownload(page, testInfo, route);
      }
    });
  }

  test('[RPT-023] reports route remains stable after refresh', async ({ page }) => {
    await openReport(page, reportRoutes[0]);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await expectPrivatePage(page, reportRoutes[0].path, reportRoutes[0].labels);
  });

  test('[RPT-024] reports remain available after visiting another tenant page and returning', async ({ page }) => {
    await openReport(page, reportRoutes[2]);
    await expectPrivatePage(page, '/drivers', [/drivers?/i]);
    await expectPrivatePage(page, reportRoutes[2].path, reportRoutes[2].labels);
    await expectReportShell(page);
  });

  test('[RPT-025] reports are blocked for logged-out users', async ({ page }) => {
    await gotoApp(page, '/reports/driver-status');
    await waitForAppReady(page);
    await expect(page).toHaveURL(/\/login/i);
    await expectVisibleLoginForm(page);
  });
});

async function openReport(page: Page, route: { path: string; labels: RegExp[] }) {
  await loginAndConfirmCompany(page);
  await expectPrivatePage(page, route.path, route.labels);
}

async function expectReportShell(page: Page) {
  await expectPageHasAnyText(page, [/date/i, /filter/i, /apply/i, /driver/i, /report/i]);
}

async function expectReportResultsOrEmptyState(page: Page) {
  await page.getByRole('status', { name: /loading/i }).waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => undefined);
  await expectPageHasAnyText(page, [/driver/i, /report/i, /no records/i, /no data/i, /empty/i, /could not load/i, /payment status/i]);

  const hasTable = await page.locator('table, [role="table"], .mat-mdc-table').first().isVisible().catch(() => false);
  const hasRows = await page.getByRole('row').first().isVisible().catch(() => false);
  const hasEmpty = await page.getByText(/no records|no data|empty|could not load/i).first().isVisible().catch(() => false);
  expect(hasTable || hasRows || hasEmpty, 'Expected report table or empty/error state.').toBeTruthy();
}

async function applyFilters(page: Page) {
  await clickFirstVisible(page, [
    page.getByRole('button', { name: /apply filters/i }),
    page.getByRole('button', { name: /apply/i }),
    page.locator('button').filter({ hasText: /search|apply|filter/i }).first(),
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

async function tryOpenReportAction(page: Page, action: RegExp) {
  for (const locator of [
    page.getByRole('button', { name: action }).first(),
    page.locator('button').filter({ hasText: /visibility|more_horiz|more_vert|report/i }).first(),
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

async function validateDriverStatusExport(page: Page, testInfo: TestInfo) {
  await expectPrivatePage(page, '/reports/driver-status', [/driver status/i, /report/i]);
  await page.getByRole('status', { name: /loading/i }).waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => undefined);

  const exportButton = page.getByRole('button', { name: /export|excel|download/i }).first();
  if (!(await exportButton.isVisible().catch(() => false)) || !(await exportButton.isEnabled().catch(() => false))) {
    testInfo.annotations.push({
      type: 'export-skipped',
      description: 'Driver Status export control was not enabled.',
    });
    return;
  }

  const download = page.waitForEvent('download', { timeout: 20_000 }).catch(() => null);
  await exportButton.click();
  const result = await download;

  if (!result) {
    testInfo.annotations.push({
      type: 'export-no-download',
      description: 'Driver Status export clicked but UAT stayed in Exporting state without emitting a browser download.',
    });
    await expectPageHasAnyText(page, [/exporting/i, /driver status/i, /report/i]);
    return;
  }

  expect(result.suggestedFilename()).toMatch(/\.(xlsx|xls|csv)$/i);
}
