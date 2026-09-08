import { test } from '@playwright/test';
import { expectPrivatePage, loginAndConfirmCompany, tenantRoutes } from './helpers/3pl';

test.describe('Primary navigation routes', () => {
  test('[NAV-001] all primary 3PL routes load after company confirmation', async ({ page }) => {
    test.setTimeout(240_000);

    await loginAndConfirmCompany(page);

    for (const route of tenantRoutes) {
      await expectPrivatePage(page, route.path, route.labels);
    }
  });
});
