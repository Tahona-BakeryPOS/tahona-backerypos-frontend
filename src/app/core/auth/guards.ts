import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DeviceConfigStore } from '../device/device-config.store';
import { ShiftStore } from '../shift/shift.store';
import { BACKOFFICE_PERMS, Perm, Permission } from './permissions';
import { SessionStore } from './session.store';

/**
 * Register guards, in the flow's order: pair device → PIN → open shift → sell.
 * The backoffice does not depend on the register: it signs in with email and password from any device.
 */
export const devicePairedGuard: CanActivateFn = () =>
  inject(DeviceConfigStore).isPaired() || inject(Router).createUrlTree(['/pair-device']);

export const authGuard: CanActivateFn = () =>
  inject(SessionStore).user()?.kind === 'pos' || inject(Router).createUrlTree(['/login']);

export const shiftOpenGuard: CanActivateFn = () =>
  inject(ShiftStore).isOpen() || inject(Router).createUrlTree(['/shift']);

/** If a shift is already open, it makes no sense to show "Abrir turno". */
export const noShiftGuard: CanActivateFn = () =>
  !inject(ShiftStore).isOpen() || inject(Router).createUrlTree(['/pos']);

/**
 * Backoffice: a backoffice session already ready (password changed and company chosen, or a
 * platform session). If a step is missing, it goes back to sign-in, which resumes where it left off.
 */
export const backofficeGuard: CanActivateFn = () => {
  const s = inject(SessionStore);
  const u = s.user();
  const ready = u?.kind === 'backoffice' && !u.mustChangePassword && (s.canAny(BACKOFFICE_PERMS) || s.can(Perm.platformAdmin));
  return ready || inject(Router).createUrlTree(['/backoffice/sign-in']);
};

export const permissionGuard =
  (...perms: Permission[]): CanActivateFn =>
  () => {
    const s = inject(SessionStore);
    return s.canAny(perms) || inject(Router).createUrlTree([landingFor(s)]);
  };

/** First backoffice screen according to the session. */
export function landingFor(s: SessionStore): string {
  if (s.can(Perm.reportsView)) return '/backoffice/dashboard';
  if (s.can(Perm.organizationManage)) return '/backoffice/business/company';
  if (s.canAny([Perm.catalogManage, Perm.branchPrices])) return '/backoffice/products/catalog';
  if (s.can(Perm.inventoryView)) return '/backoffice/inventory/stock';
  if (s.can(Perm.platformAdmin)) return '/backoffice/platform/companies';
  return '/backoffice/sin-acceso';
}
