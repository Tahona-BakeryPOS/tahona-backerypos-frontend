# E2E tests (Playwright)

They walk through the cash flow against a real API with PostgreSQL: pair the register, sign in with a PIN, open the cash
session, make two sales, void and return authorized with a supervisor's PIN, close with no difference and run the
backoffice report. They do not test Bold or Siigo: those are tested in their sandboxes (the backend runbook, "Tests with providers").

## Requirements

- A running environment: local (`ng serve` + API + development Postgres) or **staging**. Never production: the
  setup refuses to run if the URL is not `localhost` or does not contain `staging`.
- A test company with its owner (final password already set), with electronic invoicing turned off.
- Browser: `npx playwright install chromium` (once).

## Variables

| Variable | What it is for |
|---|---|
| `E2E_BASE_URL` | Frontend URL (default `http://localhost:4200`) |
| `E2E_API_URL` | API URL (default `$E2E_BASE_URL/api/v1`) |
| `E2E_OWNER_EMAIL`, `E2E_OWNER_PASSWORD` | Owner of the test company |
| `E2E_COMPANY_ID` | Optional, if the user belongs to several companies |
| `E2E_IGNORE_HTTPS_ERRORS` | `1` with the local development certificate |

Each run creates its own branch, cash register, cashier, supervisor and product (names carry a run suffix) and leaves
`e2e/.state.json` with the generated PINs (not versioned).

## Running

```bash
npm run e2e
```

The HTML report is written to `e2e/playwright-report/`.
