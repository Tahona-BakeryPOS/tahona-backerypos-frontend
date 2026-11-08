/** Códigos de permiso de la API (catálogo en BakeryPOS.Application/Common/Security/Permissions.cs). */
export const Perm = {
  plataformaAdmin: 'plataforma.admin',
  organizacionGestionar: 'organizacion.gestionar',
  reportesVer: 'reportes.ver',
  productosVer: 'productos.ver',
  catalogoGestionar: 'catalogo.gestionar',
  preciosSucursal: 'precios.sucursal',
  inventarioVer: 'inventario.ver',
  inventarioAjustar: 'inventario.ajustar',
  turnosAbrir: 'turnos.abrir',
  turnosCerrar: 'turnos.cerrar',
  cajaMovimientos: 'caja.movimientos',
  cajaRetiro: 'caja.retiro',
  ventasCrear: 'ventas.crear',
  ventasVer: 'ventas.ver',
  ventasAnular: 'ventas.anular',
  devolucionesCrear: 'devoluciones.crear',
  devolucionesAprobar: 'devoluciones.aprobar',
  fiscalGestionar: 'fiscal.gestionar',
  pagosResolver: 'pagos.resolver',
  // v1: el backend v2 los reemplaza o los agrega en su fase.
  ventasSincronizar: 'ventas.sincronizar',
  ventasDescuento: 'ventas.descuento',
} as const;

export type Permission = (typeof Perm)[keyof typeof Perm];

/** Nombres legibles para mostrar los permisos de cada rol. */
export const PERMISSION_LABELS: Record<string, string> = {
  'plataforma.admin': 'Administrar la plataforma',
  'organizacion.gestionar': 'Gestionar empresa, sucursales y usuarios',
  'reportes.ver': 'Ver reportes',
  'productos.ver': 'Ver productos',
  'catalogo.gestionar': 'Gestionar catálogo',
  'precios.sucursal': 'Precios por sucursal',
  'inventario.ver': 'Ver inventario',
  'inventario.ajustar': 'Ajustar inventario',
  'turnos.abrir': 'Abrir turno',
  'turnos.cerrar': 'Cerrar turno',
  'caja.movimientos': 'Ingresos y retiros de caja',
  'caja.retiro': 'Autorizar retiros',
  'ventas.crear': 'Vender',
  'ventas.ver': 'Ver ventas',
  'ventas.anular': 'Anular ventas',
  'devoluciones.crear': 'Registrar devoluciones',
  'devoluciones.aprobar': 'Aprobar devoluciones',
  'fiscal.gestionar': 'Configuración fiscal',
  'pagos.resolver': 'Resolver pagos sin respuesta de la pasarela',
};

/** Permisos que abren el backoffice de una empresa. */
export const BACKOFFICE_PERMS: Permission[] = [Perm.reportesVer, Perm.catalogoGestionar, Perm.organizacionGestionar, Perm.preciosSucursal, Perm.inventarioVer, Perm.fiscalGestionar];
