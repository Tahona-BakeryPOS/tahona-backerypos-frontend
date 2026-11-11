import { defineConfig, devices } from '@playwright/test';

/**
 * E2E of the PWA against a real API with PostgreSQL (testing-strategy.md). It starts no servers: it points at an environment
 * already running (staging, or local with `ng serve` + API). Variables in e2e/README.md. Payments only in cash and with
 * invoicing off: Bold and Siigo are tested separately in their sandboxes (runbook).
 */
export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  outputDir: 'test-results',
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:4200',
    ignoreHTTPSErrors: !!process.env['E2E_IGNORE_HTTPS_ERRORS'],
    trace: 'retain-on-failure',
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } }],
});
