const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');

loadEnvFile(path.resolve(process.cwd(), '.env'));

const baseURL = process.env.THREE_PL_BASE_URL || 'https://3pl.demo.dr.tmd1.org';
const email = process.env.THREE_PL_ONE_COMPANY_USER;
const password = process.env.THREE_PL_ONE_COMPANY_PASSWORD;
const outputDir = path.resolve(process.cwd(), 'docs', 'screenshots');

const pages = [
  { title: 'Dashboard', path: '/dashboard', file: 'dashboard.png' },
  { title: 'Drivers', path: '/drivers', file: 'drivers.png' },
  { title: 'Orders', path: '/orders', file: 'orders.png' },
  { title: 'Driver Status Report', path: '/reports/driver-status', file: 'reports-driver-status.png' },
  { title: 'Finance Report', path: '/reports/finance', file: 'reports-finance.png' },
  { title: 'Driver Activity Report', path: '/reports/driver-activity', file: 'reports-driver-activity.png' },
  { title: 'Driver Activity Details Report', path: '/reports/driver-activity-details', file: 'reports-driver-activity-details.png' },
  { title: 'Driver Performance Report', path: '/reports/driver-performance', file: 'reports-driver-performance.png' },
  { title: 'Individual Driver Performance Report', path: '/reports/driver-individual-performance', file: 'reports-driver-individual-performance.png' },
  { title: 'Company Settlement', path: '/settlement/company-settlement', file: 'settlement-company-settlement.png' },
  { title: 'Pending Receipts', path: '/settlement/pending-receipts', file: 'settlement-pending-receipts.png' },
  { title: 'Bird Eye View', path: '/bird-eye-view', file: 'bird-eye-view.png' },
];

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  try {
    await captureLogin(page);

    if (!email || !password) {
      throw new Error('THREE_PL_ONE_COMPANY_USER and THREE_PL_ONE_COMPANY_PASSWORD are required for authenticated screenshots.');
    }

    await login(page);

    for (const pageInfo of pages) {
      await captureProtectedPage(page, pageInfo);
    }
  } finally {
    await browser.close();
  }
}

async function captureLogin(page) {
  await gotoApp(page, '/login');
  await waitForAppReady(page);
  await screenshot(page, 'login-page.png');
}

async function login(page) {
  await gotoApp(page, '/login');
  await fillFirstVisible(page, [
    page.getByLabel(/email|username|user name/i),
    page.getByPlaceholder(/email|username|user name/i),
    page.locator('input[type="email"]'),
    page.locator('input[formcontrolname*="email" i]'),
    page.locator('input[formcontrolname*="user" i]'),
    page.locator('input[type="text"]').first(),
  ], email);
  await fillFirstVisible(page, [
    page.getByLabel(/password/i),
    page.getByPlaceholder(/password/i),
    page.locator('input[type="password"]'),
    page.locator('input[formcontrolname*="password" i]'),
  ], password);
  await clickFirstVisible(page, [
    page.getByRole('button', { name: /login|log in|sign in/i }),
    page.locator('button[type="submit"]'),
    page.locator('input[type="submit"]'),
  ]);

  await waitForAppReady(page);
  await confirmCompanyIfRequired(page);
}

async function captureProtectedPage(page, pageInfo) {
  console.log(`Capturing ${pageInfo.title}: ${pageInfo.path}`);
  await gotoApp(page, pageInfo.path);
  await waitForAppReady(page);
  await closeTransientOverlays(page);
  await screenshot(page, pageInfo.file);
}

async function confirmCompanyIfRequired(page) {
  const companyDialog = page.getByRole('dialog', { name: /select company/i });
  const hasDialog = await companyDialog.isVisible().catch(() => false);
  const hasContinue = await page
    .getByRole('button', { name: /confirm|continue|select|proceed/i })
    .first()
    .isVisible()
    .catch(() => false);

  if (!hasDialog && !hasContinue) {
    return;
  }

  const companyButton = companyDialog
    .getByRole('button')
    .filter({ hasText: /operations|logistics|delivery|business|company/i })
    .first();
  if (await companyButton.isVisible().catch(() => false)) {
    await companyButton.click();
  }

  const rowOrCard = page
    .locator('mat-row, tr, mat-card, .company-card, [role="option"], [role="listitem"]')
    .filter({ hasText: /\S/ })
    .first();
  if (await rowOrCard.isVisible().catch(() => false)) {
    await rowOrCard.click().catch(() => undefined);
  }

  await clickFirstVisible(page, [
    page.getByRole('button', { name: /confirm|continue|select|proceed|dashboard/i }),
    page.getByText(/confirm|continue|select|proceed|dashboard/i),
  ]);
  await waitForAppReady(page);
}

async function closeTransientOverlays(page) {
  await page.keyboard.press('Escape').catch(() => undefined);
  await waitForAppReady(page);
}

async function screenshot(page, file) {
  await page.screenshot({
    path: path.join(outputDir, file),
    fullPage: false,
    animations: 'disabled',
  });
}

async function fillFirstVisible(page, locators, value) {
  const target = await resolveVisible(locators);
  await target.fill(value);
}

async function clickFirstVisible(page, locators) {
  const target = await resolveVisible(locators);
  await target.click();
}

async function resolveVisible(locators) {
  for (const locator of locators) {
    const first = locator.first();
    if (await first.isVisible().catch(() => false)) {
      return first;
    }
  }

  return locators[0].first();
}

async function waitForAppReady(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
  await page
    .locator('mat-progress-spinner, mat-spinner, .loader, .loading, [aria-busy="true"]')
    .first()
    .waitFor({ state: 'hidden', timeout: 15_000 })
    .catch(() => undefined);
  await page.waitForTimeout(700);
}

async function gotoApp(page, url) {
  const target = new URL(url, baseURL).toString();
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    } catch (error) {
      lastError = error;
      const retryable = /net::ERR_NETWORK_CHANGED|net::ERR_INTERNET_DISCONNECTED|net::ERR_CONNECTION_CLOSED|net::ERR_CONNECTION_RESET|net::ERR_TIMED_OUT|Navigation timeout/i.test(String(error));
      if (!retryable || attempt === 3) {
        throw error;
      }
      await page.waitForTimeout(1_000 * attempt);
    }
  }

  throw lastError;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = /^([\w.-]+)\s*=\s*(.*)$/.exec(trimmed);
    if (!match || process.env[match[1]] !== undefined) {
      continue;
    }

    process.env[match[1]] = stripEnvQuotes(match[2].trim());
  }
}

function stripEnvQuotes(value) {
  const quote = value[0];
  return (quote === '"' || quote === "'") && value.endsWith(quote) ? value.slice(1, -1) : value;
}
