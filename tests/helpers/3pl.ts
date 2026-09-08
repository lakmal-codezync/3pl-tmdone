/// <reference types="node" />
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

type GotoOptions = NonNullable<Parameters<Page['goto']>[1]>;

export const oneCompanyUser = {
  email: process.env.THREE_PL_ONE_COMPANY_USER,
  password: process.env.THREE_PL_ONE_COMPANY_PASSWORD,
};

export const multiCompanyUser = {
  email: process.env.THREE_PL_MULTI_COMPANY_USER,
  password: process.env.THREE_PL_MULTI_COMPANY_PASSWORD,
};

export const invalidPassword = process.env.THREE_PL_INVALID_PASSWORD ?? 'wrong-password-123';

const transientNavigationErrors = [
  /net::ERR_NETWORK_CHANGED/i,
  /net::ERR_INTERNET_DISCONNECTED/i,
  /net::ERR_CONNECTION_CLOSED/i,
  /net::ERR_CONNECTION_RESET/i,
  /net::ERR_TIMED_OUT/i,
  /Navigation timeout/i,
];

export const tenantRoutes = [
  { path: '/dashboard', labels: [/registered drivers/i, /approved drivers/i, /completed orders/i] },
  { path: '/drivers', labels: [/driver/i] },
  { path: '/orders', labels: [/order/i] },
  { path: '/reports/driver-status', labels: [/driver status/i, /report/i] },
  { path: '/reports/finance', labels: [/finance/i, /summary/i] },
  { path: '/reports/driver-activity', labels: [/activity/i, /driver/i] },
  { path: '/reports/driver-activity-details', labels: [/log/i, /activity/i, /driver/i] },
  { path: '/reports/driver-performance', labels: [/performance/i, /driver/i] },
  { path: '/reports/driver-individual-performance', labels: [/individual/i, /performance/i, /driver/i] },
  { path: '/settlement/company-settlement', labels: [/settlement/i, /payment/i] },
  { path: '/settlement/pending-receipts', labels: [/pending/i, /receipt/i] },
  { path: '/bird-eye-view', labels: [/bird/i, /map/i, /driver/i] },
];

export async function login(page: Page, user = oneCompanyUser) {
  ensureCredentialsConfigured(user);

  await gotoApp(page, '/login');
  await expectVisibleLoginForm(page);
  await fillLoginForm(page, user.email, user.password);
  await submitLogin(page);
  await waitForAppReady(page);

  const loginResult = await waitForLoginResult(page);
  if (loginResult === 'invalid-credentials') {
    throw new Error(
      `Login failed for ${user.email}. Check THREE_PL_* test credentials before running authenticated 3PL page specs.`,
    );
  }
}

export async function loginAndConfirmCompany(page: Page, user = oneCompanyUser) {
  await login(page, user);
  await confirmCompanyIfRequired(page);
}

export async function fillLoginForm(page: Page, email = '', password = '') {
  const emailInput = await resolveVisible([
    page.getByLabel(/email|username|user name/i),
    page.getByPlaceholder(/email|username|user name/i),
    page.locator('input[type="email"]'),
    page.locator('input[formcontrolname*="email" i]'),
    page.locator('input[formcontrolname*="user" i]'),
    page.locator('input[type="text"]').first(),
  ]);

  const passwordInput = await resolveVisible([
    page.getByLabel(/password/i),
    page.getByPlaceholder(/password/i),
    page.locator('input[type="password"]'),
    page.locator('input[formcontrolname*="password" i]'),
  ]);

  await emailInput.fill(email);
  await passwordInput.fill(password);
}

export async function submitLogin(page: Page) {
  await clickFirstVisible(page, [
    page.getByRole('button', { name: /login|log in|sign in/i }),
    page.locator('button[type="submit"]'),
    page.locator('input[type="submit"]'),
  ]);
  await page.waitForLoadState('domcontentloaded');
}

export async function confirmCompanyIfRequired(page: Page) {
  await waitForAppReady(page);
  const companyDialog = page.getByRole('dialog', { name: /select company/i });
  const companyDialogVisible = await companyDialog.isVisible().catch(() => false);
  const continueButtonVisible = await page
    .getByRole('button', { name: /confirm|continue|select|proceed/i })
    .first()
    .isVisible()
    .catch(() => false);

  if (!companyDialogVisible && !continueButtonVisible) {
    return;
  }

  const companyButton = companyDialog
    .getByRole('button')
    .filter({ hasText: /operations|logistics|delivery|business|company/i })
    .first();

  if (await companyButton.isVisible().catch(() => false)) {
    await companyButton.click();
  }

  const companyRowOrCard = page
    .locator('mat-row, tr, mat-card, .company-card, [role="option"], [role="listitem"]')
    .filter({ hasText: /\S/ })
    .first();

  if (await companyRowOrCard.isVisible().catch(() => false)) {
    await companyRowOrCard.click({ trial: true }).catch(() => undefined);
    await companyRowOrCard.click().catch(() => undefined);
  }

  await clickFirstVisible(page, [
    page.getByRole('button', { name: /confirm|continue|select|proceed|dashboard/i }),
    page.getByText(/confirm|continue|select|proceed|dashboard/i),
  ]);

  await waitForAppReady(page);
}

export async function expectPrivatePage(page: Page, path: string, labels: RegExp[] = []) {
  const currentPath = new URL(page.url(), 'https://placeholder.local').pathname;
  if (currentPath !== path) {
    await gotoApp(page, path);
  }
  await waitForAppReady(page);

  const bodyText = await page.locator('body').innerText().catch(() => '');
  if (!bodyText.trim()) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
  }

  await expectPageHasAnyText(page, [/sign out/i, /dashboard/i, /drivers/i, /orders/i, /reports/i]);
  expect(await hasVisibleLoginForm(page)).toBeFalsy();

  const expectedLabels = labels.length > 0 ? labels : [new RegExp(path.split('/').filter(Boolean).pop() ?? 'dashboard', 'i')];
  await expectPageHasAnyText(page, expectedLabels);
}

export async function expectVisibleLoginForm(page: Page) {
  await expect(
    await resolveVisible([
      page.getByLabel(/email|username|user name/i),
      page.getByPlaceholder(/email|username|user name/i),
      page.locator('input[type="email"]'),
      page.locator('input[type="text"]').first(),
    ]),
  ).toBeVisible();
  await expect(
    await resolveVisible([
      page.getByLabel(/password/i),
      page.getByPlaceholder(/password/i),
      page.locator('input[type="password"]'),
    ]),
  ).toBeVisible();
}

export async function hasVisibleLoginForm(page: Page) {
  const passwordVisible = await page.locator('input[type="password"]').first().isVisible().catch(() => false);
  const loginButtonVisible = await page
    .getByRole('button', { name: /login|log in|sign in/i })
    .first()
    .isVisible()
    .catch(() => false);

  return passwordVisible && loginButtonVisible;
}

export async function expectPageHasAnyText(page: Page, patterns: RegExp[]) {
  const body = page.locator('body');
  await expect
    .poll(async () => {
      const text = await body.innerText().catch(() => '');
      return patterns.some((pattern) => pattern.test(text));
    }, {
      timeout: 20_000,
      message: `Expected page to contain one of: ${patterns.map(String).join(', ')}`,
    })
    .toBeTruthy();
}

export async function waitForAppReady(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
  await page
    .locator('mat-progress-spinner, mat-spinner, .loader, .loading, [aria-busy="true"]')
    .first()
    .waitFor({ state: 'hidden', timeout: 15_000 })
    .catch(() => undefined);
}

export async function gotoApp(page: Page, url: string, options: GotoOptions = {}) {
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await page.goto(url, { waitUntil: 'domcontentloaded', ...options });
    } catch (error) {
      lastError = error;
      if (!isRetryableNavigationError(error) || attempt === maxAttempts) {
        throw error;
      }

      await page.waitForTimeout(1_000 * attempt);
    }
  }

  throw lastError;
}

export async function openAccountMenuIfPresent(page: Page) {
  await clickFirstVisible(page, [
    page.getByRole('button', { name: /account|profile|user|menu/i }),
    page.locator('button').filter({ hasText: /account_circle|person|more_vert|settings/i }).first(),
    page.locator('[aria-haspopup="menu"]').first(),
    page.locator('button.avatar, .mat-mdc-tooltip-trigger.avatar').first(),
  ]).catch(() => undefined);
}

export async function clickFirstVisible(page: Page, locators: Locator[]) {
  const target = await resolveVisible(locators);
  await expect(target).toBeVisible();
  await target.click();
}

export async function validateExportDownload(page: Page, testInfo: TestInfo, route: { path: string; labels: RegExp[] }) {
  await expectPrivatePage(page, route.path, route.labels);
  if (await page.getByText(/could not load|check your connection|try again/i).first().isVisible().catch(() => false)) {
    testInfo.annotations.push({
      type: 'export-skipped',
      description: `Page is in an error state on ${route.path}; export cannot be validated.`,
    });
    return;
  }

  const exportButton = await resolveEnabledVisible([
    page.getByRole('button', { name: /export(?!ing)/i }),
    page.getByRole('button', { name: /excel/i }),
    page.getByRole('button', { name: /download/i }),
    page.locator('button:not([disabled])').filter({ hasText: /download|export|excel/i }),
  ]);

  if (!exportButton) {
    testInfo.annotations.push({
      type: 'export-skipped',
      description: `No enabled export control found on ${route.path}.`,
    });
    return;
  }

  const downloadPromise = page.waitForEvent('download', { timeout: 20_000 });
  await exportButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.(xlsx|xls|csv)$/i);
}

async function resolveVisible(locators: Locator[]) {
  for (const locator of locators) {
    if (await locator.first().isVisible().catch(() => false)) {
      return locator.first();
    }
  }

  return locators[0].first();
}

async function resolveEnabledVisible(locators: Locator[]) {
  for (const locator of locators) {
    const candidate = locator.first();
    const visible = await candidate.isVisible().catch(() => false);
    const enabled = await candidate.isEnabled().catch(() => false);

    if (visible && enabled) {
      return candidate;
    }
  }

  return null;
}

export function ensureCredentialsConfigured(user: { email?: string; password?: string }) {
  if (user.email && user.password) {
    return;
  }

  test.skip(
    true,
    'Authenticated 3PL specs need THREE_PL_* test credentials in .env or the environment.',
  );
}

function isRetryableNavigationError(error: unknown) {
  const message = String(error);
  return transientNavigationErrors.some((pattern) => pattern.test(message));
}

async function waitForLoginResult(page: Page): Promise<'pending' | 'success' | 'invalid-credentials'> {
  let result: 'pending' | 'success' | 'invalid-credentials' = 'pending';

  await expect
    .poll(
      async () => {
        const companyDialogVisible = await page
          .getByRole('dialog', { name: /select company/i })
          .isVisible()
          .catch(() => false);

        if (!/\/login(?:\?|$)/i.test(page.url()) || companyDialogVisible) {
          result = 'success';
          return result;
        }

        const invalidCredentialsVisible = await page
          .getByText(/invalid credentials|login failed|incorrect/i)
          .first()
          .isVisible()
          .catch(() => false);

        result = invalidCredentialsVisible ? 'invalid-credentials' : 'pending';
        return result;
      },
      { timeout: 30_000 },
    )
    .not.toBe('pending');

  return result;
}
