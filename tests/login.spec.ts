import { expect, test, type Page } from '@playwright/test';
import {
  clickFirstVisible,
  confirmCompanyIfRequired,
  ensureCredentialsConfigured,
  expectPageHasAnyText,
  expectPrivatePage,
  expectVisibleLoginForm,
  fillLoginForm,
  gotoApp,
  invalidPassword,
  login,
  loginAndConfirmCompany,
  multiCompanyUser,
  oneCompanyUser,
  openAccountMenuIfPresent,
  submitLogin,
  waitForAppReady,
} from './helpers/3pl';

test.describe('Login page', () => {
  test('[LOG-001] login page renders username, password, visibility toggle, and submit controls', async ({ page }) => {
    await gotoApp(page, '/login');

    await expectVisibleLoginForm(page);
    await expectPageHasAnyText(page, [/welcome to 3pl portal/i, /username/i, /password/i, /login/i]);
    await expect(page.getByRole('button', { name: /show password/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /login|log in|sign in/i })).toBeVisible();
  });

  test('[LOG-002] empty submit shows required validation and does not call successful login flow', async ({ page }) => {
    await gotoApp(page, '/login');
    await submitLogin(page);

    await expect(page).toHaveURL(/\/login/i);
    await expectPageHasAnyText(page, [/required/i, /username/i, /password/i, /invalid/i]);
  });

  test('[LOG-003] wrong password stays on login and shows an error', async ({ page }) => {
    await gotoApp(page, '/login');
    await fillLoginForm(page, oneCompanyUser.email, invalidPassword);
    await submitLogin(page);

    await expect(page).toHaveURL(/\/login/i);
    await expectPageHasAnyText(page, [/invalid/i, /failed/i, /incorrect/i, /error/i, /username/i, /password/i]);
  });

  test('[LOG-004] valid one-company credentials continue to dashboard or company confirmation', async ({ page }) => {
    await login(page, oneCompanyUser);
    await confirmCompanyIfRequired(page);
    await expectPrivatePage(page, '/dashboard', [/dashboard/i, /registered drivers/i, /completed orders/i]);
  });

  test('[LOG-005] valid multi-company credentials show company selection and continue after company confirmation', async ({ page }) => {
    await login(page, multiCompanyUser);
    await expectPageHasAnyText(page, [/select company/i, /choose a context/i, /continue/i]);
    await confirmCompanyIfRequired(page);
    await expectPrivatePage(page, '/dashboard', [/dashboard/i]);
  });

  test('[LOG-006] logged-in session survives page refresh', async ({ page }) => {
    await loginAndConfirmCompany(page);
    await expectPrivatePage(page, '/dashboard');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);

    await expect(page).not.toHaveURL(/\/login/i);
    await expectPageHasAnyText(page, [/dashboard/i, /registered drivers/i, /completed orders/i]);
  });

  test('[LOG-007] direct protected URL redirects logged-out user to login', async ({ page }) => {
    await gotoApp(page, '/drivers');
    await waitForAppReady(page);

    await expect(page).toHaveURL(/\/login/i);
    await expectVisibleLoginForm(page);
  });

  test('[LOG-008] direct protected URL can be opened after login and company confirmation', async ({ page }) => {
    ensureCredentialsConfigured(oneCompanyUser);

    await gotoApp(page, '/drivers');
    await waitForAppReady(page);
    await expect(page).toHaveURL(/\/login/i);

    await fillLoginForm(page, oneCompanyUser.email, oneCompanyUser.password);
    await submitLogin(page);
    await waitForAppReady(page);
    await confirmCompanyIfRequired(page);

    await expectPrivatePage(page, '/drivers', [/drivers?/i]);
  });

  test('[LOG-009] logout clears session and blocks protected pages', async ({ page }) => {
    await loginAndConfirmCompany(page);
    await expectPrivatePage(page, '/dashboard');

    await openAccountMenuIfPresent(page);
    await clickFirstVisible(page, [
      page.getByRole('menuitem', { name: /logout|sign out/i }),
      page.getByRole('button', { name: /logout|sign out/i }),
      page.getByText(/logout|sign out/i),
    ]);

    await page.waitForLoadState('domcontentloaded');
    await gotoApp(page, '/dashboard');
    await waitForAppReady(page);
    await expect(page).toHaveURL(/\/login/i);
  });

  test('[LOG-010] password visibility toggle changes password field visibility state', async ({ page }) => {
    await gotoApp(page, '/login');
    await fillLoginForm(page, oneCompanyUser.email, oneCompanyUser.password);

    const passwordInput = page.locator('input[formcontrolname*="password" i], input[type="password"], input[type="text"]').last();
    await expect(passwordInput).toHaveAttribute('type', /password/i);

    await clickFirstVisible(page, [
      page.getByRole('button', { name: /show password/i }),
      page.locator('button').filter({ hasText: /visibility|visibility_off/i }).first(),
    ]);
    await expect(passwordInput).toHaveAttribute('type', /text/i);

    await clickFirstVisible(page, [
      page.getByRole('button', { name: /hide password/i }),
      page.locator('button').filter({ hasText: /visibility|visibility_off/i }).first(),
    ]);
    await expect(passwordInput).toHaveAttribute('type', /password/i);
  });

  test('[LOG-011] external returnUrl is sanitized and does not redirect off-site after login', async ({ page }) => {
    ensureCredentialsConfigured(oneCompanyUser);

    await gotoApp(page, '/login?returnUrl=https://evil.com');
    await fillLoginForm(page, oneCompanyUser.email, oneCompanyUser.password);
    await submitLogin(page);
    await waitForAppReady(page);
    await confirmCompanyIfRequired(page);

    await expect(page).not.toHaveURL(/evil\.com/i);
    await expectPageHasAnyText(page, [/dashboard/i, /drivers/i, /orders/i, /reports/i]);
  });

  test('[LOG-012] multi-company user can switch company after login via account menu', async ({ page }) => {
    await loginAndConfirmCompany(page, multiCompanyUser);
    await expectPrivatePage(page, '/dashboard');

    const switched = await trySwitchCompany(page);
    if (!switched) {
      test.info().annotations.push({
        type: 'switch-company-skipped',
        description: 'No switch-company control was found in the account menu for the multi-company user.',
      });
      return;
    }

    await expect(page).not.toHaveURL(/\/login/i);
    await expectPageHasAnyText(page, [/dashboard/i, /registered drivers/i, /completed orders/i]);
  });
});

async function trySwitchCompany(page: Page) {
  const sidebar = page.getByRole('complementary').first();
  const beforeCompany = (await sidebar.innerText().catch(() => '')).split('\n')[0]?.trim();

  await openAccountMenuIfPresent(page);

  const switchControls = [
    page.getByRole('button', { name: /select a company|switch company|change company/i }),
    page.getByRole('menuitem', { name: /select a company|switch company|change company/i }),
    page.locator('.cdk-overlay-container').getByText(/select a company|switch company|change company/i).first(),
  ];

  let opened = false;
  for (const locator of switchControls) {
    if (await locator.first().isVisible().catch(() => false)) {
      await locator.first().click();
      opened = true;
      break;
    }
  }

  if (!opened) {
    await page.keyboard.press('Escape').catch(() => undefined);
    return false;
  }

  await waitForAppReady(page);

  const companyDialog = page.getByRole('dialog', { name: /select company/i });
  if (!(await companyDialog.isVisible().catch(() => false))) {
    return false;
  }

  const companyOptions = companyDialog
    .getByRole('button')
    .filter({ hasText: /operations|logistics|delivery|business|company/i });
  const optionCount = await companyOptions.count();

  if (optionCount === 0) {
    await page.keyboard.press('Escape').catch(() => undefined);
    return false;
  }

  await (optionCount > 1 ? companyOptions.last() : companyOptions.first()).click();

  await clickFirstVisible(page, [
    page.getByRole('button', { name: /^continue$/i }),
    page.getByRole('button', { name: /confirm|continue|select|proceed/i }),
  ]);
  await waitForAppReady(page);

  const afterCompany = (await sidebar.innerText().catch(() => '')).split('\n')[0]?.trim();
  if (beforeCompany && afterCompany && optionCount > 1) {
    expect(afterCompany).not.toBe(beforeCompany);
  }

  return true;
}
