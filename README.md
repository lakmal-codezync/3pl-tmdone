# 3PL TMDONE Playwright Tests

Automated Playwright coverage for the 3PL TMDONE portal.

## Screenshots

Login page:

![3PL login page](docs/screenshots/login-page.png)

Playwright report:

![Playwright test report](docs/screenshots/playwright-report.png)

## Running Tests

The public login and logged-out route tests can run without credentials:

```sh
npm test -- --project=chromium
```

Authenticated specs need credentials. Copy `.env.example` to `.env`, then fill:

```ini
THREE_PL_ONE_COMPANY_USER=
THREE_PL_ONE_COMPANY_PASSWORD=
THREE_PL_MULTI_COMPANY_USER=
THREE_PL_MULTI_COMPANY_PASSWORD=
```

When those values are missing, Playwright marks authenticated tests as skipped. The tests also retry transient navigation errors such as `ERR_NETWORK_CHANGED` and `ERR_INTERNET_DISCONNECTED`, which can happen while navigating to the remote UAT site.

## GitHub Actions

The workflow in `.github/workflows/playwright.yml` runs on push, pull request, manual dispatch, and every day at 2:00 AM Asia/Colombo.

GitHub Actions cron is UTC, so the configured schedule is:

```yaml
cron: '30 20 * * *'
```

After every run, the workflow emails `lakmal@codezync.com` with each test ID, test explanation, browser project, and status.

## GitHub Secrets

Add these repository secrets before relying on the scheduled workflow:

| Secret | Required | Description |
| --- | --- | --- |
| `THREE_PL_BASE_URL` | Yes | 3PL portal base URL, for example `https://3pl.demo.dr.tmd1.org`. |
| `THREE_PL_ONE_COMPANY_USER` | Yes | Username/email for the one-company test user. |
| `THREE_PL_ONE_COMPANY_PASSWORD` | Yes | Password for the one-company test user. |
| `THREE_PL_MULTI_COMPANY_USER` | Yes | Username/email for the multi-company test user. |
| `THREE_PL_MULTI_COMPANY_PASSWORD` | Yes | Password for the multi-company test user. |
| `THREE_PL_INVALID_PASSWORD` | No | Invalid password used for negative login tests. Defaults to `wrong-password-123`. |
| `SMTP_HOST` | Yes | SMTP server hostname used to send result email. |
| `SMTP_PORT` | Yes | SMTP server port, usually `587` for STARTTLS or `465` for TLS. |
| `SMTP_USERNAME` | Yes | SMTP username. |
| `SMTP_PASSWORD` | Yes | SMTP password or app password. |
| `SMTP_FROM` | Yes | Sender email address, for example `qa@codezync.com`. |
| `SMTP_SECURE` | No | Set `true` for port `465`; use `false` for STARTTLS on port `587`. |
