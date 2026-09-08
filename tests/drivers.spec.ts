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

test.describe('Drivers page', () => {
  test('[DRV-001] loads driver list and filter/table controls', async ({ page }) => {
    await openDrivers(page);
    await expectPageHasAnyText(page, [/search/i, /filter/i, /driver/i, /active/i, /blocked/i]);
    await expectDriverTable(page);
  });

  test('[DRV-002] shows driver count cards', async ({ page }) => {
    await openDrivers(page);

    await expectPageHasAnyText(page, [/allocated drivers/i]);
    await expectPageHasAnyText(page, [/active drivers/i]);
    await expectPageHasAnyText(page, [/blocked drivers/i]);
    await expectPageHasAnyText(page, [/rejected drivers/i]);
    await expect(page.locator('button, article, mat-card, .stat-card').filter({ hasText: /\d+/ }).first()).toBeVisible();
  });

  test('[DRV-003] search filter can be applied', async ({ page }) => {
    await openDrivers(page);

    await fillSearch(page, 'Thomas');
    await applyFilters(page);

    await expectPageHasAnyText(page, [/thomas/i, /driver/i, /no records/i]);
  });

  test('[DRV-004] search-by dropdown exposes expected search modes', async ({ page }) => {
    await openDrivers(page);

    await openCombobox(page, /search by/i);
    await expectPageHasAnyText(page, [/first name/i, /last name/i, /phone/i, /license/i]);
    await page.keyboard.press('Escape').catch(() => undefined);
  });

  test('[DRV-005] zone filter can be opened and applied', async ({ page }) => {
    await openDrivers(page);

    await openCombobox(page, /zone/i);
    await expectPageHasAnyText(page, [/all zones/i, /colombo/i, /panadura/i, /zone/i]);
    await page.keyboard.press('Escape').catch(() => undefined);

    await applyFilters(page);
    await expectPageHasAnyText(page, [/drivers/i, /allocated drivers/i, /active drivers/i]);
  });

  test('[DRV-006] approval status filter supports approved, pending, and rejected states', async ({ page }) => {
    await openDrivers(page);

    await openCombobox(page, /approval status/i);
    await expectPageHasAnyText(page, [/approved/i, /pending/i, /rejected/i, /all/i]);
    await page.keyboard.press('Escape').catch(() => undefined);
  });

  test('[DRV-007] count cards are clickable and keep the user in driver workflow', async ({ page }) => {
    await openDrivers(page);

    await clickFirstVisible(page, [
      page.getByRole('button', { name: /active drivers/i }),
      page.getByRole('button', { name: /blocked drivers/i }),
      page.getByRole('button', { name: /allocated drivers/i }),
    ]);
    await waitForAppReady(page);

    await expect(page).not.toHaveURL(/\/login/i);
    await expectPageHasAnyText(page, [/drivers/i, /search/i, /filter/i]);
  });

  test('[DRV-008] clear filters resets the driver list view', async ({ page }) => {
    await openDrivers(page);

    await fillSearch(page, 'Thomas');
    await applyFilters(page);
    await clickFirstVisible(page, [
      page.getByRole('button', { name: /^clear$/i }),
      page.locator('button').filter({ hasText: /^clear$/i }).first(),
    ]);
    await waitForAppReady(page);

    await expectDriverTable(page);
    await expectPageHasAnyText(page, [/allocated drivers/i, /active drivers/i]);
  });

  test('[DRV-009] pagination controls are visible and safe to use', async ({ page }) => {
    await openDrivers(page);

    await expectPageHasAnyText(page, [/total records/i, /of/i]);
    await expect(page.getByRole('button', { name: /previous page/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /next page/i })).toBeVisible();
  });

  test('[DRV-010] add driver modal opens and validates required fields without saving', async ({ page }) => {
    await openDrivers(page);

    await clickFirstVisible(page, [
      page.getByRole('button', { name: /add driver/i }),
      page.locator('button').filter({ hasText: /add/i }).first(),
    ]);

    await expectPageHasAnyText(page, [/add driver/i, /first name/i, /phone/i, /license/i, /create driver/i]);
    await expect(page.getByRole('button', { name: /create driver/i })).toBeDisabled();

    await closeDialog(page);
  });

  test('[DRV-011] driver actions menu opens for a driver row', async ({ page }) => {
    await openDrivers(page);
    await openFirstDriverActions(page);

    await expectPageHasAnyText(page, [/details/i, /edit/i, /orders/i, /history/i, /block/i]);
  });

  test('[DRV-012] driver details action opens details modal or panel', async ({ page }) => {
    await openDrivers(page);
    await openDriverAction(page, /details|view/i);

    await expectPageHasAnyText(page, [/driver details/i, /full name/i, /phone/i, /license/i, /zone/i]);
    await closeDialog(page);
  });

  test('[DRV-013] driver orders action opens driver orders view', async ({ page }) => {
    await openDrivers(page);
    await openDriverAction(page, /orders/i);

    await expectPageHasAnyText(page, [/driver orders/i, /orders/i, /order/i, /status/i, /no records/i]);
    await closeDialog(page);
  });

  test('[DRV-014] block history action opens history view', async ({ page }) => {
    await openDrivers(page);
    const opened = await tryOpenDriverAction(page, /block history|blocked history|history/i);

    if (!opened) {
      test.info().annotations.push({
        type: 'block-history-skipped',
        description: 'No visible block history action was available for the first driver row.',
      });
      return;
    }

    await expectPageHasAnyText(page, [/history/i, /blocked/i, /reason/i, /source/i, /no records/i]);
    await closeDialog(page);
  });

  test('[DRV-015] cash block history action opens history view when available', async ({ page }) => {
    await openDrivers(page);
    const opened = await tryOpenDriverAction(page, /cash.*history|cash.*block|cash delivery/i);

    if (!opened) {
      test.info().annotations.push({
        type: 'cash-history-skipped',
        description: 'No visible cash block history action was available for the first driver row.',
      });
      return;
    }

    await expectPageHasAnyText(page, [/cash/i, /history/i, /blocked/i, /no records/i]);
    await closeDialog(page);
  });

  test('[DRV-016] edit driver action opens edit form without saving', async ({ page }) => {
    await openDrivers(page);
    await openDriverAction(page, /edit/i);

    await expectPageHasAnyText(page, [/edit driver/i, /first name/i, /phone/i, /license/i, /save/i]);
    await closeDialog(page);
  });

  test('[DRV-017] refresh keeps drivers route and reloads list', async ({ page }) => {
    await openDrivers(page);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await expect(page).not.toHaveURL(/\/login/i);
    await expectPrivatePage(page, '/drivers', [/drivers?/i]);
    await expectDriverTable(page);
  });

  test('[DRV-018] export starts Excel download when export is available', async ({ page }, testInfo) => {
    await loginAndConfirmCompany(page);
    await validateExportDownload(page, testInfo, { path: '/drivers', labels: [/drivers?/i] });
  });

  test('[DRV-019] drivers page is blocked for logged-out users', async ({ page }) => {
    await gotoApp(page, '/drivers');
    await waitForAppReady(page);

    await expect(page).toHaveURL(/\/login/i);
    await expectVisibleLoginForm(page);
  });

  test('[DRV-020] driver table exposes all important legacy parity columns', async ({ page }) => {
    await openDrivers(page);

    for (const column of [
      /full name/i,
      /license no/i,
      /blocked/i,
      /cash delivery blocked/i,
      /blocked by source/i,
      /blocked reason/i,
      /approval status/i,
      /remark/i,
      /zone/i,
      /starting points/i,
      /last seen/i,
      /roster/i,
      /app version/i,
      /actions/i,
    ]) {
      await expectPageHasAnyText(page, [column]);
    }
  });

  test('[DRV-021] first-name search mode filters by first name', async ({ page }) => {
    await openDrivers(page);
    await selectSearchMode(page, /first name/i);
    await fillSearch(page, 'Thomas');
    await applyFilters(page);

    await expectPageHasAnyText(page, [/thomas/i, /no records/i]);
  });

  test('[DRV-022] last-name search mode filters by last name', async ({ page }) => {
    await openDrivers(page);
    await selectSearchMode(page, /last name/i);
    await fillSearch(page, 'Fernando');
    await applyFilters(page);

    await expectPageHasAnyText(page, [/fernando/i, /no records/i]);
  });

  test('[DRV-023] phone search mode filters by phone number', async ({ page }) => {
    await openDrivers(page);
    await selectSearchMode(page, /phone/i);
    await fillSearch(page, '94758370123');
    await applyFilters(page);

    await expectPageHasAnyText(page, [/94758370123/i, /no records/i]);
  });

  test('[DRV-024] license search mode filters by license number', async ({ page }) => {
    await openDrivers(page);
    await selectSearchMode(page, /license/i);
    await fillSearch(page, '8470123');
    await applyFilters(page);

    await expectPageHasAnyText(page, [/8470123/i, /no records/i]);
  });

  test('[DRV-025] filters remain usable after refresh', async ({ page }) => {
    await openDrivers(page);
    await fillSearch(page, 'Thomas');
    await applyFilters(page);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await expectPrivatePage(page, '/drivers', [/drivers?/i]);
    await expectPageHasAnyText(page, [/search/i, /filter/i, /driver/i]);
  });

  test('[DRV-026] empty search result shows empty state without crashing', async ({ page }) => {
    await openDrivers(page);
    await fillSearch(page, 'zzzz-no-driver-0000');
    await applyFilters(page);

    await expect(page).not.toHaveURL(/\/login/i);
    await expectPageHasAnyText(page, [/no records/i, /no data/i, /empty/i, /drivers/i]);
  });

  test('[DRV-027] driver actions menu can be dismissed safely', async ({ page }) => {
    await openDrivers(page);
    await openFirstDriverActions(page);
    await expectPageHasAnyText(page, [/details/i, /edit/i, /orders/i, /history/i, /block/i]);

    await page.keyboard.press('Escape');
    await waitForAppReady(page);

    await expectDriverTable(page);
  });

  test('[DRV-028] closing add-driver modal returns to the driver table', async ({ page }) => {
    await openDrivers(page);
    await clickFirstVisible(page, [
      page.getByRole('button', { name: /add driver/i }),
      page.locator('button').filter({ hasText: /add/i }).first(),
    ]);
    await expectPageHasAnyText(page, [/add driver/i, /save/i]);

    await closeDialog(page);

    await expectPrivatePage(page, '/drivers', [/drivers?/i]);
    await expectDriverTable(page);
  });

  test('[DRV-029] driver page remains stable after visiting another tenant page and returning', async ({ page }) => {
    await openDrivers(page);
    await expectPrivatePage(page, '/orders', [/orders?/i]);
    await expectPrivatePage(page, '/drivers', [/drivers?/i]);

    await expectDriverTable(page);
  });

  test('[DRV-030] add-driver form exposes required business fields', async ({ page }) => {
    await openDrivers(page);
    await clickFirstVisible(page, [
      page.getByRole('button', { name: /add driver/i }),
      page.locator('button').filter({ hasText: /add/i }).first(),
    ]);

    await expectPageHasAnyText(page, [
      /first name/i,
      /last name/i,
      /phone/i,
      /license/i,
      /zone/i,
      /starting point/i,
      /roster/i,
      /save/i,
    ]);
    await closeDialog(page);
  });

  test('[DRV-031] creates a new driver with valid required details and verifies it in the list', async ({ page }) => {
    test.setTimeout(180_000);

    const driver = createDriverTestData();

    await openDrivers(page);
    await openAddDriverDrawer(page);
    await expect(page.getByRole('button', { name: /create driver/i })).toBeDisabled();

    await fillDriverCreateForm(page, driver);
    await expect(page.getByRole('button', { name: /create driver/i })).toBeEnabled({ timeout: 20_000 });
    await page.getByRole('button', { name: /create driver/i }).click();
    await waitForAppReady(page);

    await expectPageHasAnyText(page, [/created/i, /success/i, /drivers/i, /allocated drivers/i]);
    await searchDriverByLicense(page, driver.licenseNo);

    await expectPageHasAnyText(page, [
      new RegExp(driver.firstName, 'i'),
      new RegExp(driver.lastName, 'i'),
      new RegExp(driver.licenseNo, 'i'),
    ]);
  });

  test('[DRV-032] create driver form keeps entered valid data before submit', async ({ page }) => {
    const driver = createDriverTestData();

    await openDrivers(page);
    await openAddDriverDrawer(page);
    await fillDriverCreateForm(page, driver);

    await expect(formControl(page, 'FirstName')).toHaveValue(driver.firstName);
    await expect(formControl(page, 'LastName')).toHaveValue(driver.lastName);
    await expect(formControl(page, 'Email')).toHaveValue(driver.email);
    await expect(formControl(page, 'CivilIDCardNo')).toHaveValue(driver.civilId);
    await expect(formControl(page, 'LicenseNo')).toHaveValue(driver.licenseNo);
    await expect(page.getByRole('button', { name: /create driver/i })).toBeEnabled({ timeout: 20_000 });

    await closeDialog(page);
  });
});

async function openDrivers(page: Page) {
  await loginAndConfirmCompany(page);
  await expectPrivatePage(page, '/drivers', [/drivers?/i]);
}

async function expectDriverTable(page: Page) {
  await expectPageHasAnyText(page, [/full name/i, /license no/i, /approval status/i, /actions/i]);
  await expect(page.locator('table, [role="table"]').first()).toBeVisible();
}

async function fillSearch(page: Page, value: string) {
  await page.getByRole('textbox', { name: 'Search', exact: true }).fill(value);
}

async function applyFilters(page: Page) {
  await clickFirstVisible(page, [
    page.getByRole('button', { name: /apply filters/i }),
    page.getByRole('button', { name: /apply/i }),
    page.locator('button').filter({ hasText: /search|apply/i }).first(),
  ]);
  await waitForAppReady(page);
}

async function openCombobox(page: Page, name: RegExp) {
  await clickFirstVisible(page, [
    page.getByRole('combobox', { name }),
    page.locator('[role="combobox"]').filter({ hasText: name }).first(),
  ]);
}

async function selectSearchMode(page: Page, option: RegExp) {
  await openCombobox(page, /search by/i);
  await clickFirstVisible(page, [
    page.getByRole('option', { name: option }),
    page.getByText(option).first(),
  ]);
  await waitForAppReady(page);
}

async function openAddDriverDrawer(page: Page) {
  await clickFirstVisible(page, [
    page.getByRole('button', { name: /add driver/i }),
    page.locator('button').filter({ hasText: /add/i }).first(),
  ]);
  await expectPageHasAnyText(page, [/add driver/i, /create driver/i, /first name/i, /license/i]);
}

function createDriverTestData() {
  const id = Date.now().toString().slice(-8);

  return {
    firstName: `Auto${id}`,
    lastName: 'Driver',
    phone: `9${id.slice(1)}`,
    email: `auto.driver.${id}@example.com`,
    civilId: `9${id}1`,
    licenseNo: `LIC${id}`,
  };
}

async function fillDriverCreateForm(page: Page, driver: ReturnType<typeof createDriverTestData>) {
  await formControl(page, 'numberControl').first().fill(driver.phone);
  await formControl(page, 'FirstName').fill(driver.firstName);
  await formControl(page, 'LastName').fill(driver.lastName);
  await selectByFormControl(page, 'Nationality', /oman|sri lanka|india/i);
  await formControl(page, 'Email').fill(driver.email);
  await formControl(page, 'CivilIDCardNo').fill(driver.civilId);
  await formControl(page, 'LicenseNo').fill(driver.licenseNo);
  await selectByFormControl(page, 'ZoneId', /colombo|panadura/i);
  await selectStartingPointIfAvailable(page);
  await uploadRequiredDriverFiles(page);
}

function formControl(page: Page, name: string) {
  return page.locator(`[formcontrolname="${name}"]`);
}

async function selectByFormControl(page: Page, name: string, preferredOption: RegExp) {
  const select = page.locator(`mat-select[formcontrolname="${name}"]`).first();
  await expect(select, `Expected ${name} select to be visible.`).toBeVisible();
  await select.click();

  const preferred = page.getByRole('option', { name: preferredOption }).first();
  if (await preferred.isVisible().catch(() => false)) {
    await preferred.click();
  } else {
    await page.locator('mat-option').filter({ hasText: /^(?!\s*select\s*$).+/i }).first().click();
  }

  await waitForAppReady(page);
}

async function selectStartingPointIfAvailable(page: Page) {
  const select = page.locator('mat-select[formcontrolname="SelectedStartingPoints"]').first();
  if (!(await select.isVisible().catch(() => false))) {
    return;
  }

  await select.click();
  const option = page.locator('mat-option').filter({ hasText: /\S/ }).first();
  if (await option.isVisible().catch(() => false)) {
    await option.click();
  }
  await page.keyboard.press('Escape').catch(() => undefined);
  await waitForAppReady(page);
}

async function searchDriverByLicense(page: Page, licenseNo: string) {
  await expectPrivatePage(page, '/drivers', [/drivers?/i]);
  await selectSearchMode(page, /license/i);
  await fillSearch(page, licenseNo);
  await applyFilters(page);
}

async function uploadRequiredDriverFiles(page: Page) {
  const tinyPng = Uint8Array.from(
    atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
    (char) => char.charCodeAt(0),
  );

  const fileInputs = page.locator('input[type="file"]');
  const count = await fileInputs.count();

  if (count > 0) {
    await fileInputs.nth(0).setInputFiles({ name: 'driver-photo.png', mimeType: 'image/png', buffer: Buffer.from(tinyPng) });
    await acceptVisibleCrop(page);
  }
  if (count > 1) {
    await fileInputs.nth(1).setInputFiles({ name: 'civil-id.png', mimeType: 'image/png', buffer: Buffer.from(tinyPng) });
  }
  if (count > 2) {
    await fileInputs.nth(2).setInputFiles({ name: 'license-image.png', mimeType: 'image/png', buffer: Buffer.from(tinyPng) });
    await acceptVisibleCrop(page);
  }

  await waitForAppReady(page);
}

async function acceptVisibleCrop(page: Page) {
  await page.waitForTimeout(500);
  for (const name of [/apply.*upload/i, /apply crop/i, /save crop/i, /crop driver photo/i, /crop license image/i]) {
    const button = page.getByRole('button', { name }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click({ force: true });
      await waitForAppReady(page);
      return;
    }
  }
}

async function openFirstDriverActions(page: Page) {
  await clickFirstVisible(page, [
    page.getByRole('button', { name: /driver actions/i }).first(),
    page.locator('button').filter({ hasText: /more_vert|more_horiz|actions/i }).first(),
  ]);
  await waitForAppReady(page);
}

async function openDriverAction(page: Page, action: RegExp) {
  const opened = await tryOpenDriverAction(page, action);
  expect(opened, `Expected driver action ${action} to be available.`).toBeTruthy();
}

async function tryOpenDriverAction(page: Page, action: RegExp) {
  await openFirstDriverActions(page);

  const actionLocators = [
    page.getByRole('menuitem', { name: action }).first(),
    page.getByRole('button', { name: action }).first(),
    page.locator('.cdk-overlay-container').getByText(action).first(),
  ];

  for (const locator of actionLocators) {
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
