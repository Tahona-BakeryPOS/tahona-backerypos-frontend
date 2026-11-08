import { Perm, Permission } from '../../core/auth/permissions';

export type MenuIcon = 'panel' | 'store' | 'box' | 'chef' | 'truck' | 'register' | 'chart' | 'gear';

export interface MenuItem {
  label: string;
  /** Ruta bajo /backoffice. Sin ruta = aún no existe contra la API v2 ("Próximamente"). */
  route?: string;
  /** Basta con uno de ellos. */
  perm?: Permission | Permission[];
}

export interface MenuGroup {
  label: string;
  icon: MenuIcon;
  items: MenuItem[];
}

const soon = (...labels: string[]): MenuItem[] => labels.map((label) => ({ label }));

/**
 * Navegación del backoffice. Solo llevan ruta las pantallas que ya funcionan contra la API v2
 * (fase 2: plataforma, empresa, sucursales y cajas, puntos de venta, usuarios y roles; fase 3:
 * catálogo, categorías, unidades, impuestos y auditoría; fase 4: existencias, movimientos y ajustes; fase 5: turnos y cierres; fase 6: pagos, métodos de pago e integraciones; fase 7: facturación electrónica, facturas y numeraciones). Las de la v1 vuelven al menú cuando su fase
 * adapta la pantalla (backend: docs/implementation-plan.md); mientras tanto se ven como "Próximamente".
 */
export const BACKOFFICE_MENU: MenuGroup[] = [
  {
    label: 'Plataforma',
    icon: 'gear',
    items: [{ label: 'Empresas', route: 'plataforma/empresas', perm: Perm.plataformaAdmin }],
  },
  {
    label: 'Panel de control',
    icon: 'panel',
    items: [{ label: 'Resumen del día', route: 'panel', perm: Perm.reportesVer }],
  },
  {
    label: 'Mi negocio',
    icon: 'store',
    items: [
      { label: 'Empresa', route: 'negocio/empresa', perm: Perm.organizacionGestionar },
      { label: 'Sucursales y cajas', route: 'negocio/sucursales', perm: Perm.organizacionGestionar },
      ...soon('Bodegas'),
      { label: 'Puntos de venta', route: 'negocio/puntos-venta', perm: Perm.organizacionGestionar },
    ],
  },
  {
    label: 'Productos e inventario',
    icon: 'box',
    items: [
      { label: 'Catálogo y precios', route: 'productos/catalogo', perm: [Perm.catalogoGestionar, Perm.preciosSucursal] },
      { label: 'Categorías', route: 'productos/categorias', perm: Perm.catalogoGestionar },
      { label: 'Unidades', route: 'productos/unidades', perm: Perm.catalogoGestionar },
      { label: 'Existencias', route: 'inventario/existencias', perm: Perm.inventarioVer },
      { label: 'Movimientos', route: 'inventario/movimientos', perm: Perm.inventarioVer },
      { label: 'Ajustes', route: 'inventario/ajustes', perm: Perm.inventarioAjustar },
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
      { label: 'Ventas', route: 'ventas/ventas', perm: Perm.ventasVer },
      { label: 'Turnos', route: 'ventas/turnos', perm: Perm.reportesVer },
      ...soon('Arqueos'),
      { label: 'Cierres', route: 'ventas/cierres', perm: Perm.reportesVer },
      { label: 'Pagos', route: 'ventas/pagos', perm: Perm.reportesVer },
      { label: 'Devoluciones', route: 'ventas/devoluciones', perm: Perm.reportesVer },
      { label: 'Facturas electrónicas', route: 'ventas/documentos-fiscales', perm: Perm.ventasVer },
      { label: 'Métodos de pago', route: 'ventas/medios-pago', perm: Perm.organizacionGestionar },
    ],
  },
  {
    label: 'Informes',
    icon: 'chart',
    items: [
      { label: 'Ventas', route: 'informes/ventas', perm: Perm.reportesVer },
      ...soon('Costos', 'Márgenes', 'Inventario', 'Mermas'),
      { label: 'Auditoría', route: 'informes/auditoria', perm: Perm.organizacionGestionar },
    ],
  },
  {
    label: 'Configuración',
    icon: 'gear',
    items: [
      { label: 'Usuarios', route: 'configuracion/usuarios', perm: Perm.organizacionGestionar },
      { label: 'Roles', route: 'configuracion/roles', perm: Perm.organizacionGestionar },
      { label: 'Impuestos', route: 'configuracion/impuestos', perm: Perm.catalogoGestionar },
      { label: 'Facturación electrónica', route: 'configuracion/facturacion', perm: Perm.fiscalGestionar },
      { label: 'Numeraciones', route: 'configuracion/numeraciones', perm: Perm.fiscalGestionar },
      { label: 'Integraciones', route: 'configuracion/integraciones', perm: Perm.organizacionGestionar },
      { label: 'Historial de cambios', route: 'configuracion/historial', perm: Perm.organizacionGestionar },
    ],
  },
];
