import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DeviceConfigStore } from '../device/device-config.store';
import { ShiftStore } from '../shift/shift.store';
import { BACKOFFICE_PERMS, Perm, Permission } from './permissions';
import { SessionStore } from './session.store';

/**
 * Guards de la caja, en el orden del flujo: vincular dispositivo → PIN → abrir turno → vender.
 * El backoffice no depende de la caja: entra con correo y contraseña desde cualquier equipo.
 */
export const devicePairedGuard: CanActivateFn = () =>
  inject(DeviceConfigStore).isPaired() || inject(Router).createUrlTree(['/vincular']);

export const authGuard: CanActivateFn = () =>
  inject(SessionStore).user()?.kind === 'pos' || inject(Router).createUrlTree(['/login']);

export const shiftOpenGuard: CanActivateFn = () =>
  inject(ShiftStore).isOpen() || inject(Router).createUrlTree(['/turno']);

/** Si ya hay turno abierto, no tiene sentido mostrar "Abrir turno". */
export const noShiftGuard: CanActivateFn = () =>
  !inject(ShiftStore).isOpen() || inject(Router).createUrlTree(['/pos']);

/**
 * Backoffice: sesión de backoffice ya lista (contraseña cambiada y empresa elegida, o sesión de
 * plataforma). Si falta un paso, vuelve al ingreso, que retoma donde quedó.
 */
export const backofficeGuard: CanActivateFn = () => {
  const s = inject(SessionStore);
  const u = s.user();
  const ready = u?.kind === 'backoffice' && !u.mustChangePassword && (s.canAny(BACKOFFICE_PERMS) || s.can(Perm.plataformaAdmin));
  return ready || inject(Router).createUrlTree(['/backoffice/ingresar']);
};

export const permissionGuard =
  (...perms: Permission[]): CanActivateFn =>
  () => {
    const s = inject(SessionStore);
    return s.canAny(perms) || inject(Router).createUrlTree([landingFor(s)]);
  };

/** Primera pantalla del backoffice según la sesión. */
export function landingFor(s: SessionStore): string {
  if (s.can(Perm.reportesVer)) return '/backoffice/panel';
  if (s.can(Perm.organizacionGestionar)) return '/backoffice/negocio/empresa';
  if (s.canAny([Perm.catalogoGestionar, Perm.preciosSucursal])) return '/backoffice/productos/catalogo';
  if (s.can(Perm.inventarioVer)) return '/backoffice/inventario/existencias';
  if (s.can(Perm.plataformaAdmin)) return '/backoffice/plataforma/empresas';
  return '/backoffice/sin-acceso';
}
