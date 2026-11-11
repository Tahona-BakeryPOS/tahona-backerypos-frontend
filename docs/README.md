# Frontend documentation

What is here and what lives in the backend.

| Topic | Where |
|---|---|
| Context and conventions for Claude | [`../CLAUDE.md`](../CLAUDE.md) |
| E2E tests (Playwright) | [`../e2e/README.md`](../e2e/README.md) |
| Frontend decisions | [`decisions.md`](decisions.md) |
| Screen mockups | [`mockups/`](mockups/) |
| Own deployment (Caddy + API proxy) | [`../deploy/`](../deploy/) |
| API HTTP contract | backend repo → `docs/api-contracts.md` |
| Requirements and use cases | backend repo → `docs/requirements.md`, `docs/use-case-status.md` |
| Decisions (D-xx / I-xx) | backend repo → `docs/decisions.md` |
| Payments (Bold) and tax integration (Siigo) | backend repo → `docs/payment-integration.md`, `docs/electronic-invoicing.md` |
| Deployment and operations | backend repo → `docs/runbooks.md` |

Backend: <https://github.com/Tahona-BakeryPOS/tahona-backerypos-backend/tree/main/docs>

System decisions and specifications are kept in the backend so there is a single source; this folder only documents what is
specific to the client (screens, routes, UI state, E2E tests).
