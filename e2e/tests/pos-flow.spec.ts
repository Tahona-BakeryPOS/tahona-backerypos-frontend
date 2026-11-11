import { expect, Page, test } from '@playwright/test';
import { copDigits, E2EState, loadState } from '../fixtures';

/**
 * MVP exit criterion (testing-strategy.md), cash part: paired register → PIN → open cash session → two sales →
 * void (D-11, supervisor with PIN) → partial return → balanced close → backoffice report with the same.
 * It runs in order and shares the page (a single shift).
 */
test.describe.configure({ mode: 'serial' });

let page: Page;
let s: E2EState;
const OPENING = 50_000;

test.beforeAll(async ({ browser }) => {
  s = loadState();
  page = await browser.newPage();
});

test.afterAll(async () => {
  await page.close();
});

test('pairs the register and signs in with the cashier PIN', async () => {
  await page.goto('/pair-device');
  await page.getByLabel('Código de vinculación').fill(s.pairingCode);
  await page.getByLabel('Nombre de este equipo').fill('Equipo E2E');
  await page.getByRole('button', { name: 'Vincular' }).click();

  await page.getByRole('button', { name: s.cashier.name }).click();
  await page.keyboard.type(s.cashier.pin);
  await expect(page.getByLabel('Efectivo inicial')).toBeVisible();
});

test('opens the cash session with opening cash', async () => {
  await page.getByLabel('Efectivo inicial').fill(String(OPENING));
  await page.getByRole('button', { name: 'Abrir caja' }).click();
  await expect(page.getByRole('textbox', { name: 'Buscar producto' })).toBeVisible();
});

test('vende en efectivo exacto dos veces', async () => {
  await sell(1);
  await sell(2);
});

test('voids the first sale with the supervisor authorization', async () => {
  await page.getByRole('link', { name: 'Ventas del turno' }).click();
  const row = page.getByRole('row').filter({ hasText: copDigits(s.product.price) }).filter({ hasText: 'confirmada' }).first();
  await row.getByRole('button', { name: 'Anular' }).click();

  await page.getByLabel('Motivo').selectOption('Error de digitación');
  await authorize();
  await expect(page.getByRole('row').filter({ hasText: 'anulada' })).toHaveCount(1);
});

test('returns one unit of the second sale', async () => {
  const row = page.getByRole('row').filter({ hasText: copDigits(s.product.price * 2) }).filter({ hasText: 'confirmada' }).first();
  await row.getByRole('button', { name: 'Devolver' }).click();

  await page.getByLabel(`Cantidad a devolver de ${s.product.name}`).fill('1');
  await page.getByLabel('Motivo').fill('Pan quemado (E2E)');
  await authorize();
  await expect(page.getByText('Devolución registrada')).toBeVisible();
  await expect(row).toContainText(copDigits(s.product.price));
});

test('closes the cash session with no difference', async () => {
  // Expected = opening + 2 sales − void − return of one unit.
  const expected = OPENING + s.product.price * 3 - s.product.price - s.product.price;
  await page.getByRole('button', { name: 'Cerrar caja' }).click();
  await page.getByLabel('Efectivo contado').fill(String(expected));
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar caja' }).click();
  await expect(page.getByRole('button', { name: 'Salir' })).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText(copDigits(expected));
});

test('the backoffice report reflects sales, void and return', async () => {
  await page.goto('/backoffice/sign-in');
  await page.getByLabel('Correo').fill(s.ownerEmail);
  await page.getByLabel('Contraseña').fill(s.ownerPassword);
  await page.getByRole('button', { name: /Entrar|Ingresar/ }).click();
  const choose = page.getByRole('button', { name: /./ }).filter({ hasNotText: 'Administración de la plataforma' });
  if (await page.getByRole('heading', { name: '¿Dónde vas a trabajar?' }).isVisible().catch(() => false)) await choose.first().click();

  await page.goto('/backoffice/reports/sales');
  await page.getByLabel('Sucursal').selectOption({ label: s.branchName });
  const kpi = (label: string) => page.locator('.kpi').filter({ hasText: label });
  await expect(kpi('Vendido').first()).toContainText(copDigits(s.product.price * 2));
  await expect(kpi('Devuelto')).toContainText(copDigits(s.product.price));
  await expect(kpi('Neto')).toContainText(copDigits(s.product.price));
  await expect(kpi('Anuladas')).toContainText(copDigits(s.product.price));
});

async function sell(units: number): Promise<void> {
  const tile = page.getByRole('button', { name: new RegExp(`^${escape(s.product.name)},`) });
  for (let i = 0; i < units; i++) await tile.click();
  await page.getByRole('button', { name: /^Cobrar/ }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'Efectivo' }).click();
  await dialog.getByRole('button', { name: 'Exacto' }).click();
  await dialog.getByRole('button', { name: 'Cobrar', exact: true }).click();
  await expect(page.getByText('Venta confirmada')).toBeVisible();
  await page.getByRole('button', { name: 'Nueva venta' }).click();
}

/** The cashier does not have the permission: the supervisor authorizes with their PIN (OwnerAuthComponent). */
async function authorize(): Promise<void> {
  await page.getByLabel('Quién autoriza').selectOption({ label: s.supervisor.name });
  await page.getByLabel('PIN').fill(s.supervisor.pin);
  await page.getByRole('button', { name: 'Autorizar' }).click();
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
