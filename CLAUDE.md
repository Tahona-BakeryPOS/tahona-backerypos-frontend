# Tahona.BakeryPOS — Frontend

PWA (Angular 22, standalone, signals, OnPush) for a bakery POS SaaS in Colombia: the **cashier POS** (tablet/PC) and the **backoffice**.
This repo is **the frontend only**; the API and the system design live in the backend repo
(`tahona-backerypos-backend`). Each repo has its own CI/CD and documentation.

Repo: <https://github.com/Tahona-BakeryPOS/tahona-backerypos-frontend>
Backend: <https://github.com/Tahona-BakeryPOS/tahona-backerypos-backend> (design in its `docs/` folder).

## Language

Everything technical is in English: code identifiers, comments, commit messages and documentation. Text that users see in
the screens (labels, messages, toasts) is Spanish, because the product is for Colombian bakeries; keep it as is.

## API source of truth

The HTTP contract, permissions and business rules live in the backend, not here:
`docs/api-contracts.md`, `docs/requirements.md`, `docs/decisions.md` and `docs/use-case-status.md` of that repo.
The DTOs in `src/app/core/api/api.models.ts` mirror those of `Tahona.BakeryPOS.Application`, and the permission codes in
`src/app/core/auth/permissions.ts` come from `Common/Security/Permissions.cs`. If the backend changes a contract, adjust it here.
This frontend does not invent endpoints or responses: what the backend does not expose is shown as "Próximamente".

## Status

Screens on top of the API: backoffice sign-in (one-time password, company selection, refresh token),
platform/companies, branches and cash registers, points of sale, users and roles, device pairing and PIN sign-in;
catalog and prices, categories, units, taxes, audit; stock, movements and adjustments; opening a cash session,
Cash (income/withdrawals) and closing, Shifts and Closings; Payments, Payment methods and Integrations (Bold); electronic
invoicing (optional per company, D-17), Numberings and Electronic invoices; the POS sale (live payment, stock authorization,
receipt with the invoice status), Shift sales and Sales; void and return, Returns, Sales report and Dashboard.
**The offline mode of the previous system was removed** (the service worker only caches the app).

## Structure

```
src/app/
  core/       api (HTTP client, models, idempotency), auth, catalog, device, domain, sales, shift, storage
  features/   backoffice, login, pairing, pos, shift
  shared/     pipes, toasts and UI utilities
e2e/          Playwright against staging (see e2e/README.md)
docs/         the frontend's own documentation
```

## Conventions

- Standalone components, signals and `ChangeDetectionStrategy.OnPush`.
- HTTP access through per-module gateways (`core/api`); screens never call `HttpClient` directly.
- Every retryable POST sends `Idempotency-Key` (`newIdempotencyKey`); master-data `PUT`s send `If-Match`.
- The payment, sale, inventory and invoice states are shown separately; a payment is only considered approved when the
  backend reports it.
- Third-party secrets and keys never live in the frontend.
- Ask for approval before: adding major dependencies or changing the scope.

## Commands

```bash
npm ci
npm start                      # ng serve; /api is proxied to https://localhost:7246 (proxy.conf.json)
npm test                       # ng test
npx ng build --configuration production
npm run e2e                    # Playwright against staging
npm run e2e:typecheck
```

## CI/CD and deployment

- CI: `.github/workflows/ci.yml` (tests, production build, E2E typecheck, Docker image build).
- The image (`Dockerfile`) builds the app and serves it with Caddy (`Caddyfile`), which also terminates HTTPS and proxies
  `/api` to the API (`API_UPSTREAM`, the backend's public URL). The browser only talks to the frontend's domain,
  so CORS is not needed.
- Its own deployment in `deploy/` (compose, `.env.deploy.example` and `scripts/deploy.sh`): one environment per VPS. It does not depend on
  any file of the backend repo; it only needs to know its API's URL.
