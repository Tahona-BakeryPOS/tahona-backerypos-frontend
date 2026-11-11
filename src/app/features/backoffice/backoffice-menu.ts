import { Perm, Permission } from '../../core/auth/permissions';

export type MenuIcon = 'panel' | 'store' | 'box' | 'chef' | 'truck' | 'register' | 'chart' | 'gear';

export interface MenuItem {
  label: string;
  /** Route under /backoffice. No route = it does not exist yet against the API ("Próximamente"). */
  route?: string;
  /** One of them is enough. */
  perm?: Permission | Permission[];
}

export interface MenuGroup {
  label: string;
  icon: MenuIcon;
  items: MenuItem[];
}

const soon = (...labels: string[]): MenuItem[] => labels.map((label) => ({ label }));

/**
 * Backoffice navigation. Only the screens that already work against the API have a route
 * (phase 2: platform, company, branches and registers, points of sale, users and roles; phase 3:
 * catalog, categories, units, taxes and audit; phase 4: stock, movements and adjustments; phase 5: shifts and closings; phase 6: payments, payment methods and integrations; phase 7: electronic invoicing, invoices and numberings). The previous system's screens come back to the menu when their phase
 * adapts the screen (backend: docs/implementation-plan.md); in the meantime they are shown as "Próximamente".
 */
export const BACKOFFICE_MENU: MenuGroup[] = [
  {
    label: 'Plataforma',
    icon: 'gear',
    items: [{ label: 'Empresas', route: 'platform/companies', perm: Perm.platformAdmin }],
  },
  {
    label: 'Panel de control',
    icon: 'panel',
    items: [{ label: 'Resumen del día', route: 'dashboard', perm: Perm.reportsView }],
  },
  {
    label: 'Mi negocio',
    icon: 'store',
    items: [
      { label: 'Empresa', route: 'business/company', perm: Perm.organizationManage },
      { label: 'Sucursales y cajas', route: 'business/branches', perm: Perm.organizationManage },
      ...soon('Bodegas'),
      { label: 'Puntos de venta', route: 'business/points-of-sale', perm: Perm.organizationManage },
    ],
  },
  {
    label: 'Productos e inventario',
    icon: 'box',
    items: [
      { label: 'Catálogo y precios', route: 'products/catalog', perm: [Perm.catalogManage, Perm.branchPrices] },
      { label: 'Categorías', route: 'products/categories', perm: Perm.catalogManage },
      { label: 'Unidades', route: 'products/units', perm: Perm.catalogManage },
      { label: 'Existencias', route: 'inventory/stock', perm: Perm.inventoryView },
      { label: 'Movimientos', route: 'inventory/movements', perm: Perm.inventoryView },
      { label: 'Ajustes', route: 'inventory/adjustments', perm: Perm.inventoryAdjust },
      ...soon('Transferencias'),
    ],
  },
  {
    label: 'Producción',
    icon: 'chef',
    items: soon('Recetas', 'Órdenes de producción', 'Consumo de ingredientes', 'Lotes', 'Mermas'),
  },
  {
    label: 'Abastecimiento',
    icon: 'truck',
    items: soon('Proveedores', 'Compras', 'Recepciones'),
  },
  {
    label: 'Ventas y caja',
    icon: 'register',
    items: [
      { label: 'Ventas', route: 'sales/sales', perm: Perm.salesView },
      { label: 'Turnos', route: 'sales/shifts', perm: Perm.reportsView },
      ...soon('Arqueos'),
      { label: 'Cierres', route: 'sales/closings', perm: Perm.reportsView },
      { label: 'Pagos', route: 'sales/payments', perm: Perm.reportsView },
      { label: 'Devoluciones', route: 'sales/returns', perm: Perm.reportsView },
      { label: 'Facturas electrónicas', route: 'sales/fiscal-documents', perm: Perm.salesView },
      { label: 'Métodos de pago', route: 'sales/payment-methods', perm: Perm.organizationManage },
    ],
  },
  {
    label: 'Informes',
    icon: 'chart',
    items: [
      { label: 'Ventas', route: 'reports/sales', perm: Perm.reportsView },
      ...soon('Costos', 'Márgenes', 'Inventario', 'Mermas'),
      { label: 'Auditoría', route: 'reports/audit', perm: Perm.organizationManage },
    ],
  },
  {
    label: 'Configuración',
    icon: 'gear',
    items: [
      { label: 'Usuarios', route: 'settings/users', perm: Perm.organizationManage },
      { label: 'Roles', route: 'settings/roles', perm: Perm.organizationManage },
      { label: 'Impuestos', route: 'settings/taxes', perm: Perm.catalogManage },
      { label: 'Facturación electrónica', route: 'settings/invoicing', perm: Perm.fiscalManage },
      { label: 'Numeraciones', route: 'settings/numberings', perm: Perm.fiscalManage },
      { label: 'Integraciones', route: 'settings/integrations', perm: Perm.organizationManage },
      { label: 'Historial de cambios', route: 'settings/history', perm: Perm.organizationManage },
    ],
  },
];
