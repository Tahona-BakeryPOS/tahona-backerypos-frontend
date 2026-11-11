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
    items: [{ label: 'Empresas', route: 'plataforma/empresas', perm: Perm.platformAdmin }],
  },
  {
    label: 'Panel de control',
    icon: 'panel',
    items: [{ label: 'Resumen del día', route: 'panel', perm: Perm.reportsView }],
  },
  {
    label: 'Mi negocio',
    icon: 'store',
    items: [
      { label: 'Empresa', route: 'negocio/empresa', perm: Perm.organizationManage },
      { label: 'Sucursales y cajas', route: 'negocio/sucursales', perm: Perm.organizationManage },
      ...soon('Bodegas'),
      { label: 'Puntos de venta', route: 'negocio/puntos-venta', perm: Perm.organizationManage },
    ],
  },
  {
    label: 'Productos e inventario',
    icon: 'box',
    items: [
      { label: 'Catálogo y precios', route: 'productos/catalogo', perm: [Perm.catalogManage, Perm.branchPrices] },
      { label: 'Categorías', route: 'productos/categorias', perm: Perm.catalogManage },
      { label: 'Unidades', route: 'productos/unidades', perm: Perm.catalogManage },
      { label: 'Existencias', route: 'inventario/existencias', perm: Perm.inventoryView },
      { label: 'Movimientos', route: 'inventario/movimientos', perm: Perm.inventoryView },
      { label: 'Ajustes', route: 'inventario/ajustes', perm: Perm.inventoryAdjust },
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
      { label: 'Ventas', route: 'ventas/ventas', perm: Perm.salesView },
      { label: 'Turnos', route: 'ventas/turnos', perm: Perm.reportsView },
      ...soon('Arqueos'),
      { label: 'Cierres', route: 'ventas/cierres', perm: Perm.reportsView },
      { label: 'Pagos', route: 'ventas/pagos', perm: Perm.reportsView },
      { label: 'Devoluciones', route: 'ventas/devoluciones', perm: Perm.reportsView },
      { label: 'Facturas electrónicas', route: 'ventas/documentos-fiscales', perm: Perm.salesView },
      { label: 'Métodos de pago', route: 'ventas/medios-pago', perm: Perm.organizationManage },
    ],
  },
  {
    label: 'Informes',
    icon: 'chart',
    items: [
      { label: 'Ventas', route: 'informes/ventas', perm: Perm.reportsView },
      ...soon('Costos', 'Márgenes', 'Inventario', 'Mermas'),
      { label: 'Auditoría', route: 'informes/auditoria', perm: Perm.organizationManage },
    ],
  },
  {
    label: 'Configuración',
    icon: 'gear',
    items: [
      { label: 'Usuarios', route: 'configuracion/usuarios', perm: Perm.organizationManage },
      { label: 'Roles', route: 'configuracion/roles', perm: Perm.organizationManage },
      { label: 'Impuestos', route: 'configuracion/impuestos', perm: Perm.catalogManage },
      { label: 'Facturación electrónica', route: 'configuracion/facturacion', perm: Perm.fiscalManage },
      { label: 'Numeraciones', route: 'configuracion/numeraciones', perm: Perm.fiscalManage },
      { label: 'Integraciones', route: 'configuracion/integraciones', perm: Perm.organizationManage },
      { label: 'Historial de cambios', route: 'configuracion/historial', perm: Perm.organizationManage },
    ],
  },
];
