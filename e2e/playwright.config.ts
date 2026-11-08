import { defineConfig, devices } from '@playwright/test';

/**
 * E2E de la PWA contra una API real con PostgreSQL (testing-strategy.md). No levanta servidores: apunta a un ambiente
 * ya corriendo (staging, o local con `ng serve` + API). Variables en e2e/README.md. Pagos solo en efectivo y sin
 * facturación activa: Bold y Siigo se prueban aparte en sus sandbox (runbook).
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
