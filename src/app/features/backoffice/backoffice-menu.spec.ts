import { describe, expect, it } from 'vitest';
import { routes } from '../../app.routes';
import { BACKOFFICE_MENU } from './backoffice-menu';

describe('BACKOFFICE_MENU', () => {
  const boRoutes = routes.find((r) => r.path === 'backoffice')!.children!.map((r) => r.path);

  it('has the platform and the 8 backoffice modules', () => {
    expect(BACKOFFICE_MENU.map((g) => g.label)).toEqual([
      'Plataforma', 'Panel de control', 'Mi negocio', 'Productos e inventario', 'Producción',
      'Abastecimiento', 'Ventas y caja', 'Informes', 'Configuración',
    ]);
  });

  it('every item with a route has its page registered', () => {
    const missing = BACKOFFICE_MENU.flatMap((g) => g.items).filter((i) => i.route && !boRoutes.includes(i.route));
    expect(missing).toEqual([]);
  });

  it('items with a route declare the permission their route requires', () => {
    expect(BACKOFFICE_MENU.flatMap((g) => g.items).filter((i) => i.route && !i.perm)).toEqual([]);
  });

  it('only the screens that already work have a route', () => {
    expect(BACKOFFICE_MENU.flatMap((g) => g.items).filter((i) => i.route).map((i) => i.route)).toEqual([
      'platform/companies', 'dashboard', 'business/company', 'business/branches', 'business/points-of-sale',
      'products/catalog', 'products/categories', 'products/units',
      'inventory/stock', 'inventory/movements', 'inventory/adjustments', 'sales/sales', 'sales/shifts', 'sales/closings',
      'sales/payments', 'sales/returns', 'sales/fiscal-documents', 'sales/payment-methods', 'reports/sales', 'reports/audit',
      'settings/users', 'settings/roles', 'settings/taxes', 'settings/invoicing',
      'settings/numberings', 'settings/integrations', 'settings/history',
    ]);
  });
});
