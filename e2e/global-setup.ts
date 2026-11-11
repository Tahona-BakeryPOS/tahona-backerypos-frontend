import { writeFileSync } from 'node:fs';
import { randomInt, randomUUID } from 'node:crypto';
import { E2EState, STATE_FILE } from './fixtures';

/**
 * Prepares this run's own data through the API, inside an already existing test company (its owner with a
 * final password, E2E_OWNER_*): a new branch and cash register, a cashier and a supervisor with a PIN, a product that does not
 * track stock with a price, and a pairing code for the register. It never runs against production.
 */
export default async function globalSetup(): Promise<void> {
  const baseUrl = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
  const apiUrl = process.env['E2E_API_URL'] ?? `${baseUrl}/api/v1`;
  const email = required('E2E_OWNER_EMAIL');
  const password = required('E2E_OWNER_PASSWORD');
  if (process.env['E2E_ALLOW_ANY_HOST'] !== '1' && !/localhost|127\.0\.0\.1|staging/.test(apiUrl))
    throw new Error(`E2E solo contra local o staging (${apiUrl}). Usa E2E_ALLOW_ANY_HOST=1 si sabes lo que haces.`);

  const api = new Api(apiUrl);
  let session = await api.post<Session>('/auth/login', { email, password });
  if (session.mustChangePassword) throw new Error('El propietario de pruebas debe tener ya su contraseña definitiva.');
  api.token = session.accessToken;
  if (!session.companyId) {
    const companyId = process.env['E2E_COMPANY_ID'] ?? session.companies[0]?.id;
    if (!companyId) throw new Error('El usuario de pruebas no tiene empresa.');
    session = await api.post<Session>('/auth/select-company', { companyId, refreshToken: session.refreshToken });
    api.token = session.accessToken;
  }

  const run = Date.now().toString(36).toUpperCase().slice(-6);
  const branch = await api.post<{ id: string; name: string }>('/branches',
    { code: `E2E${run}`, name: `E2E ${run}`, address: null, cityCode: null, phone: null }, true);
  const register = await api.post<{ id: string; name: string }>('/cash-registers',
    { branchId: branch.id, code: `C${run}`, name: `Caja E2E ${run}` }, true);

  const roles = await api.get<{ id: string; code: string; permissions: string[] }[]>('/roles');
  const cashierRole = roles.find((r) => r.code === 'CASHIER');
  const supervisorRole = roles.find((r) => r.permissions.includes('sales.void') && r.permissions.includes('returns.approve')
    && r.code !== 'OWNER') ?? roles.find((r) => r.code === 'OWNER');
  if (!cashierRole || !supervisorRole) throw new Error('Faltan los roles del sistema (CASHIER / supervisor).');

  const cashier = { name: `Cajero ${run}`, pin: pin() };
  const supervisor = { name: `Supervisor ${run}`, pin: pin() };
  await api.post('/users', { fullName: cashier.name, email: null, pin: cashier.pin, assignments: [{ roleId: cashierRole.id, branchId: branch.id }] });
  await api.post('/users', { fullName: supervisor.name, email: null, pin: supervisor.pin, assignments: [{ roleId: supervisorRole.id, branchId: branch.id }] });

  const [categories, units, taxes] = await Promise.all([
    api.get<{ id: string; isActive?: boolean }[]>('/categories'),
    api.get<{ id: string; code: string }[]>('/units'),
    api.get<{ id: string; rate: number; isActive: boolean }[]>('/taxes'),
  ]);
  const unit = units.find((u) => u.code === 'UND');
  const tax = taxes.find((t) => t.isActive && t.rate === 19) ?? taxes.find((t) => t.isActive);
  if (!categories[0] || !unit || !tax) throw new Error('La empresa de pruebas necesita categoría, unidad UND e impuesto activos.');
  const product = { name: `Pan E2E ${run}`, price: 2_500 };
  await api.post('/products', {
    sku: `E2E-${run}`, name: product.name, categoryId: categories[0].id, unitId: unit.id, taxId: tax.id, barcode: null,
    trackStock: false, negativeStockPolicy: 'allow', basePrice: product.price,
  }, true);

  const pairing = await api.post<{ code: string }>(`/cash-registers/${register.id}/pairing-codes`, {});

  const state: E2EState = {
    apiUrl, ownerEmail: email, ownerPassword: password, branchName: branch.name, cashRegisterName: register.name,
    pairingCode: pairing.code, cashier, supervisor, product,
  };
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
}

interface Session {
  accessToken: string;
  refreshToken: string | null;
  companyId: string | null;
  mustChangePassword: boolean;
  companies: { id: string }[];
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable ${name} (ver e2e/README.md).`);
  return v;
}

/** 6-digit PIN without repeating the same digit throughout. */
function pin(): string {
  return String(randomInt(100_000, 999_999));
}

class Api {
  token: string | null = null;

  constructor(private readonly base: string) {}

  get<T>(path: string): Promise<T> {
    return this.send<T>('GET', path);
  }

  post<T = unknown>(path: string, body: unknown, idempotent = false): Promise<T> {
    return this.send<T>('POST', path, body, idempotent ? { 'Idempotency-Key': randomUUID() } : {});
  }

  private async send<T>(method: string, path: string, body?: unknown, extra: Record<string, string> = {}): Promise<T> {
    const res = await fetch(this.base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}), ...extra },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
    return (text ? JSON.parse(text) : undefined) as T;
  }
}
