/** API permission codes (catalog in Tahona.BakeryPOS.Application/Common/Security/Permissions.cs). */
export const Perm = {
  platformAdmin: 'platform.admin',
  organizationManage: 'organization.manage',
  reportsView: 'reports.view',
  productsView: 'products.view',
  catalogManage: 'catalog.manage',
  branchPrices: 'prices.branch',
  inventoryView: 'inventory.view',
  inventoryAdjust: 'inventory.adjust',
  shiftsOpen: 'shifts.open',
  shiftsClose: 'shifts.close',
  cashMovements: 'cash.movements',
  cashWithdrawal: 'cash.withdrawal',
  salesCreate: 'sales.create',
  salesView: 'sales.view',
  salesVoid: 'sales.void',
  returnsCreate: 'returns.create',
  returnsApprove: 'returns.approve',
  fiscalManage: 'fiscal.manage',
  paymentsResolve: 'payments.resolve',
  salesDiscount: 'sales.discount',
} as const;

export type Permission = (typeof Perm)[keyof typeof Perm];

/** Human-readable (Spanish) names shown for each role permission. */
export const PERMISSION_LABELS: Record<string, string> = {
  'platform.admin': 'Administrar la plataforma',
  'organization.manage': 'Gestionar empresa, sucursales y usuarios',
  'reports.view': 'Ver reportes',
  'products.view': 'Ver productos',
  'catalog.manage': 'Gestionar catálogo',
  'prices.branch': 'Precios por sucursal',
  'inventory.view': 'Ver inventario',
  'inventory.adjust': 'Ajustar inventario',
  'shifts.open': 'Abrir turno',
  'shifts.close': 'Cerrar turno',
  'cash.movements': 'Ingresos y retiros de caja',
  'cash.withdrawal': 'Autorizar retiros',
  'sales.create': 'Vender',
  'sales.view': 'Ver ventas',
  'sales.void': 'Anular ventas',
  'returns.create': 'Registrar devoluciones',
  'returns.approve': 'Aprobar devoluciones',
  'fiscal.manage': 'Configuración fiscal',
  'payments.resolve': 'Resolver pagos sin respuesta de la pasarela',
};

/** Permissions that open a company backoffice. */
export const BACKOFFICE_PERMS: Permission[] = [Perm.reportsView, Perm.catalogManage, Perm.organizationManage, Perm.branchPrices, Perm.inventoryView, Perm.fiscalManage];
