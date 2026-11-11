# Tahona.BakeryPOS — Frontend

Progressive web app (PWA) for a bakery point-of-sale (POS) SaaS in Colombia. It includes the **cashier POS**,
designed for a tablet or PC, and the administration **backoffice**.

The API lives in its own repository:
[tahona-backerypos-backend](https://github.com/Tahona-BakeryPOS/tahona-backerypos-backend), which also holds the
system design and the API contract.

> The screens are in Spanish because the product is for Colombian bakeries. Code, comments and documentation are in English.

## What it includes

**Cashier POS**
- Pairing the device to a cash register and PIN sign-in.
- Opening a cash session, cash income and withdrawals, and closing the shift.
- Sale with card-terminal payment (Bold), stock authorization and a receipt showing the invoice status.
- Shift sales, voids and returns.

**Backoffice**
- Platform, company, branches, cash registers, users and roles.
- Catalog, prices, categories, units and taxes.
- Stock, movements and inventory adjustments.
- Shifts and closings, payments and payment methods.
- Integrations (Bold), electronic invoicing, numberings and invoices.
- Sales, returns, sales report, dashboard and audit.

Screens are shown according to the user's permissions.

## Technology

Angular 22 (standalone components, signals, `OnPush`) · TypeScript · Vitest · Playwright · service worker (PWA).

## Structure

```
src/app/
  core/       HTTP client, API models, authentication, catalog, device, sales and shift
  features/   backoffice, login, pairing, pos, shift
  shared/     pipes, notifications and UI utilities
e2e/          end-to-end tests (Playwright)
docs/         the frontend's own documentation
```

## Requirements

- Node.js 24 and npm
- The API running (by default at `https://localhost:7246`; see `proxy.conf.json`)

## Getting started

```bash
npm ci
npm start
```

Open `http://localhost:4200/`. Calls to `/api` are forwarded to the API through `proxy.conf.json`.

## Scripts

| Command | Description |
|---|---|
| `npm start` | Development server |
| `npm test` | Unit tests |
| `npx ng build --configuration production` | Production build into `dist/pos` |
| `npm run e2e` | E2E tests with Playwright (see [`e2e/README.md`](e2e/README.md)) |
| `npm run e2e:typecheck` | Checks that the E2E tests compile |

## Docker and deployment

The `Dockerfile` builds the app and serves it with Caddy, which also terminates HTTPS and proxies `/api` to the API
(`API_UPSTREAM`). The deployment belongs to this repo and does not depend on the backend:

```bash
cd deploy
cp .env.deploy.example .env.production   # fill in DOMAIN, ACME_EMAIL and API_UPSTREAM
bash ./scripts/deploy.sh .env.production
```

## CI

`.github/workflows/ci.yml`: installs dependencies, runs the tests, builds for production, type-checks the E2E tests,
builds the Docker image and publishes the build output as an artifact.

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — project context and conventions
- [`docs/README.md`](docs/README.md) — documentation index
- [`e2e/README.md`](e2e/README.md) — E2E tests
- [General guide for non-technical readers](https://github.com/Tahona-BakeryPOS/tahona-backerypos-backend/blob/main/docs/general-guide.md) (in the backend repository)
- API contract and decisions: `docs/` folder of the backend repository
