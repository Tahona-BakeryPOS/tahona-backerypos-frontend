import { describe, expect, it } from 'vitest';
import { routes } from '../../app.routes';
import { BACKOFFICE_MENU } from './backoffice-menu';

describe('BACKOFFICE_MENU', () => {
  const boRoutes = routes.find((r) => r.path === 'backoffice')!.children!.map((r) => r.path);

  it('tiene la plataforma y los 8 módulos del backoffice', () => {
    expect(BACKOFFICE_MENU.map((g) => g.label)).toEqual([
      'Plataforma', 'Panel de control', 'Mi negocio', 'Productos e inventario', 'Producción',
      'Abastecimiento', 'Ventas y caja', 'Informes', 'Configuración',
    ]);
  });

  it('cada ítem con ruta tiene su página registrada', () => {
    const missing = BACKOFFICE_MENU.flatMap((g) => g.items).filter((i) => i.route && !boRoutes.includes(i.route));
    expect(missing).toEqual([]);
  });

  it('los ítems con ruta declaran el permiso que exige su ruta', () => {
    expect(BACKOFFICE_MENU.flatMap((g) => g.items).filter((i) => i.route && !i.perm)).toEqual([]);
  });

  it('solo las pantallas de las fases 2 a 9 tienen ruta', () => {
    expect(BACKOFFICE_MENU.flatMap((g) => g.items).filter((i) => i.route).map((i) => i.route)).toEqual([
      'plataforma/empresas', 'panel', 'negocio/empresa', 'negocio/sucursales', 'negocio/puntos-venta',
      'productos/catalogo', 'productos/categorias', 'productos/unidades',
      'inventario/existencias', 'inventario/movimientos', 'inventario/ajustes', 'ventas/ventas', 'ventas/turnos', 'ventas/cierres',
      'ventas/pagos', 'ventas/devoluciones', 'ventas/documentos-fiscales', 'ventas/medios-pago', 'informes/ventas', 'informes/auditoria',
      'configuracion/usuarios', 'configuracion/roles', 'configuracion/impuestos', 'configuracion/facturacion',
      'configuracion/numeraciones', 'configuracion/integraciones', 'configuracion/historial',
    ]);
  });
});
