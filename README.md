# 3PL TMDONE Playwright Tests

End-to-end Playwright test automation for the 3PL TMDONE portal. The suite covers login, protected routing, dashboard metrics, drivers, orders, reports, settlement workflows, and the live Bird Eye View page.

## Application Screenshots

### Login

![Login page](docs/screenshots/login-page.png)

### Dashboard

![Dashboard page](docs/screenshots/dashboard.png)

### Drivers

![Drivers page](docs/screenshots/drivers.png)

### Orders

![Orders page](docs/screenshots/orders.png)

### Reports

Driver Status Report

![Driver Status Report](docs/screenshots/reports-driver-status.png)

Finance Report

![Finance Report](docs/screenshots/reports-finance.png)

Driver Activity Report

![Driver Activity Report](docs/screenshots/reports-driver-activity.png)

Driver Activity Details Report

![Driver Activity Details Report](docs/screenshots/reports-driver-activity-details.png)

Driver Performance Report

![Driver Performance Report](docs/screenshots/reports-driver-performance.png)

Individual Driver Performance Report

![Individual Driver Performance Report](docs/screenshots/reports-driver-individual-performance.png)

### Settlement

Company Settlement

![Company Settlement](docs/screenshots/settlement-company-settlement.png)

Pending Receipts

![Pending Receipts](docs/screenshots/settlement-pending-receipts.png)

### Bird Eye View

![Bird Eye View](docs/screenshots/bird-eye-view.png)

## Test Coverage

| Area | Coverage |
| --- | --- |
| Login | Form rendering, validation, invalid password handling, authenticated login, session persistence, logout, password visibility, and return URL sanitization. |
| Dashboard | KPI cards, chart presence, filter behavior, navigation from KPI cards, refresh behavior, company context, and protected routing. |
| Drivers | Filters, count cards, table columns, pagination, driver actions, add-driver form validation, export behavior, and protected routing. |
| Orders | Filters, order statuses, table columns, search, empty state, pagination, order details, export behavior, refresh behavior, and protected routing. |
| Reports | Driver status, finance, driver activity, driver activity details, driver performance, individual performance, filters, pagination, exports, and protected routing. |
| Settlement | Company settlement, pending receipts, filters, add payment, slip viewing, exports, refresh behavior, and protected routing. |
| Bird Eye View | Map surface, fleet summary, driver monitor, driver details, map controls, navigation, refresh behavior, and protected routing. |

## Updating Screenshots

Screenshots can be refreshed locally when `.env` contains valid credentials:

```sh
npm run screenshots
```

They can also be refreshed from GitHub Actions by running the `Update README Screenshots` workflow manually. That workflow uses repository secrets, captures each page, and commits updated files under `docs/screenshots`.
