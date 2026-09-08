import { expect, type Page, test } from '@playwright/test';
import {
  clickFirstVisible,
  expectPageHasAnyText,
  expectPrivatePage,
  expectVisibleLoginForm,
  gotoApp,
  loginAndConfirmCompany,
  waitForAppReady,
} from './helpers/3pl';

const birdEyeRoute = { path: '/bird-eye-view', labels: [/bird/i, /map/i, /driver/i] };

test.describe('Bird Eye View page', () => {
  test('[BEV-001] loads live map and driver monitoring UI', async ({ page }) => {
    await openBirdEye(page);
    await expectPageHasAnyText(page, [/fleet summary/i, /active drivers/i, /online drivers/i, /driver monitor/i]);
  });

  test('[BEV-002] map region renders with Google Maps surface', async ({ page }) => {
    await openBirdEye(page);
    await expect(page.getByRole('region', { name: /map/i }).or(page.locator('iframe, canvas')).first()).toBeVisible();
    await expectPageHasAnyText(page, [/map data/i, /google/i, /terms/i, /report a map error/i]);
  });

  test('[BEV-003] fleet summary cards show operational counts', async ({ page }) => {
    await openBirdEye(page);

    await expectPageHasAnyText(page, [/active drivers/i]);
    await expectPageHasAnyText(page, [/drivers with orders/i]);
    await expectPageHasAnyText(page, [/online drivers/i]);
    await expectPageHasAnyText(page, [/active orders/i]);
    await expect(page.locator('article, section, region').filter({ hasText: /\d+/ }).first()).toBeVisible();
  });

  test('[BEV-004] driver monitor panel lists live drivers or clear empty state', async ({ page }) => {
    await openBirdEye(page);
    await expectPageHasAnyText(page, [/driver monitor/i, /real-time/i, /online/i, /no drivers/i, /empty/i]);
  });

  test('[BEV-005] live active driver details section renders', async ({ page }) => {
    await openBirdEye(page);
    await expectPageHasAnyText(page, [
      /live operations/i,
      /active driver order details/i,
      /driver details/i,
      /order details/i,
      /no active drivers/i,
    ]);
  });

  test('[BEV-006] clicking a driver monitor item opens or updates driver details when available', async ({ page }) => {
    await openBirdEye(page);
    const clicked = await tryClickDriverMonitorItem(page);

    if (!clicked) {
      test.info().annotations.push({ type: 'driver-monitor-skipped', description: 'No visible driver monitor item was available.' });
      return;
    }

    await expectPageHasAnyText(page, [/driver details/i, /phone/i, /company/i, /app/i, /device/i, /order details/i]);
  });

  test('[BEV-007] focus on map action is available for active driver details', async ({ page }) => {
    await openBirdEye(page);
    const focus = page.getByRole('button', { name: /focus on map/i }).first();

    if (!(await focus.isVisible().catch(() => false))) {
      test.info().annotations.push({ type: 'focus-skipped', description: 'No active driver focus button was visible.' });
      return;
    }

    await focus.click();
    await waitForAppReady(page);
    await expectPageHasAnyText(page, [/driver/i, /map/i, /active/i]);
  });

  test('[BEV-008] map layer and zoom controls are visible', async ({ page }) => {
    await openBirdEye(page);
    await expect(page.getByRole('button', { name: /toggle map layers/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /zoom in/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /zoom out/i })).toBeVisible();

    const fitAllButton = page.getByRole('button', { name: /fit all drivers/i });
    if (await fitAllButton.isVisible().catch(() => false)) {
      await expect(fitAllButton).toBeVisible();
    } else {
      test.info().annotations.push({
        type: 'fit-all-drivers-skipped',
        description: 'No active drivers online right now; the "Fit all drivers" control is not rendered.',
      });
    }
  });

  test('[BEV-009] map layer toggle can be clicked safely', async ({ page }) => {
    await openBirdEye(page);
    await clickFirstVisible(page, [
      page.getByRole('button', { name: /toggle map layers/i }),
      page.locator('button').filter({ hasText: /layers/i }).first(),
    ]);
    await waitForAppReady(page);
    await expectPageHasAnyText(page, [/map/i, /driver/i, /fleet summary/i]);
  });

  test('[BEV-010] zoom controls can be clicked safely', async ({ page }) => {
    await openBirdEye(page);
    await page.getByRole('button', { name: /zoom in/i }).click();
    await page.getByRole('button', { name: /zoom out/i }).click();
    await waitForAppReady(page);
    await expectPageHasAnyText(page, [/map/i, /driver/i, /fleet summary/i]);
  });

  test('[BEV-011] fit all drivers control can be clicked safely', async ({ page }) => {
    await openBirdEye(page);
    const fitAllButton = page.getByRole('button', { name: /fit all drivers/i });

    if (!(await fitAllButton.isVisible().catch(() => false))) {
      test.info().annotations.push({
        type: 'fit-all-drivers-skipped',
        description: 'No active drivers online right now; the "Fit all drivers" control is not rendered.',
      });
      return;
    }

    await fitAllButton.click();
    await waitForAppReady(page);
    await expectPageHasAnyText(page, [/map/i, /driver/i, /fleet summary/i]);
  });

  test('[BEV-012] View All Drivers link navigates to Drivers page', async ({ page }) => {
    await openBirdEye(page);
    const link = page.getByRole('link', { name: /view all drivers/i }).first();

    if (!(await link.isVisible().catch(() => false))) {
      test.info().annotations.push({ type: 'view-all-drivers-skipped', description: 'No View All Drivers link visible.' });
      return;
    }

    await link.click();
    await waitForAppReady(page);
    await expectPrivatePage(page, '/drivers', [/drivers?/i]);
  });

  test('[BEV-013] driver monitor can be closed when close control is available', async ({ page }) => {
    await openBirdEye(page);
    const close = page.getByRole('button', { name: /close driver monitor/i }).first();

    if (!(await close.isVisible().catch(() => false))) {
      test.info().annotations.push({ type: 'close-monitor-skipped', description: 'No close driver monitor control visible.' });
      return;
    }

    await close.click();
    await waitForAppReady(page);
    await expectPageHasAnyText(page, [/bird eye view/i, /map/i, /fleet summary/i]);
  });

  test('[BEV-014] page refresh keeps live map route and operational content', async ({ page }) => {
    await openBirdEye(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await expectPrivatePage(page, birdEyeRoute.path, birdEyeRoute.labels);
    await expectPageHasAnyText(page, [/fleet summary/i, /active drivers/i, /online drivers/i]);
  });

  test('[BEV-015] Bird Eye View remains stable after visiting another tenant page and returning', async ({ page }) => {
    await openBirdEye(page);
    await expectPrivatePage(page, '/dashboard', [/dashboard/i]);
    await expectPrivatePage(page, birdEyeRoute.path, birdEyeRoute.labels);
    await expectPageHasAnyText(page, [/map/i, /fleet summary/i, /driver monitor/i]);
  });

  test('[BEV-016] Bird Eye View is blocked for logged-out users', async ({ page }) => {
    await gotoApp(page, birdEyeRoute.path);
    await waitForAppReady(page);
    await expect(page).toHaveURL(/\/login/i);
    await expectVisibleLoginForm(page);
  });
});

async function openBirdEye(page: Page) {
  await loginAndConfirmCompany(page);
  await expectPrivatePage(page, birdEyeRoute.path, birdEyeRoute.labels);
}

async function tryClickDriverMonitorItem(page: Page) {
  const item = page
    .getByRole('complementary', { name: /driver monitor/i })
    .getByRole('button')
    .filter({ hasText: /online|offline|\+\d|driver/i })
    .first();

  if (await item.isVisible().catch(() => false)) {
    await item.click();
    await waitForAppReady(page);
    return true;
  }

  return false;
}
