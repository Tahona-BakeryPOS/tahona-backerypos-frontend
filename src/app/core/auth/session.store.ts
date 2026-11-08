import { Injectable, computed, signal } from '@angular/core';
import { AuthSessionDto, CompanySummary } from '../api/api.models';
import { LocalStore } from '../storage/local-store';
import { Perm, Permission } from './permissions';

/** Backoffice: correo + contraseña, con refresh token. Caja: equipo vinculado + PIN, sin refresh. */
export type SessionKind = 'backoffice' | 'pos';

export interface SessionUser {
  kind: SessionKind;
  id: string;
  name: string;
  permissions: string[];
  token: string;
  expiresAt: string;
  refreshToken: string | null;
  /** Empresa del token; null mientras deba elegir una o en la sesión de plataforma. */
  companyId: string | null;
  companies: CompanySummary[];
  mustChangePassword: boolean;
  isPlatformAdmin: boolean;
}

/**
 * Sesión abierta. Vive en sessionStorage: sobrevive a recargar la pestaña, pero no a cerrarla
 * (la caja es compartida y el refresh token del backoffice no debe quedar en el equipo).
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly store = new LocalStore<SessionUser>('bakerypos.session', () => sessionStorage);
  private readonly _user = signal<SessionUser | null>(this.read());

  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly token = computed(() => this._user()?.token ?? null);
  readonly refreshToken = computed(() => this._user()?.refreshToken ?? null);
  readonly companyName = computed(() => {
    const u = this._user();
    return u?.companies.find((c) => c.id === u.companyId)?.name ?? null;
  });
  /** Rol mostrado en la barra: la API no devuelve el rol de la sesión, se deduce de los permisos. */
  readonly roleLabel = computed(() => {
    const p = this._user()?.permissions ?? [];
    if (p.includes(Perm.plataformaAdmin)) return 'Plataforma';
    if (p.includes(Perm.organizacionGestionar)) return 'Administrador';
    return 'Cajero';
  });

  start(r: AuthSessionDto, kind: SessionKind): void {
    this.set({
      kind,
      id: r.userId,
      name: r.fullName,
      permissions: r.permissions,
      token: r.accessToken,
      expiresAt: r.expiresAt,
      refreshToken: r.refreshToken,
      companyId: r.companyId,
      companies: r.companies,
      mustChangePassword: r.mustChangePassword,
      isPlatformAdmin: r.isPlatformAdmin,
    });
  }

  end(): void {
    this.set(null);
  }

  can(p: Permission): boolean {
    return this._user()?.permissions.includes(p) ?? false;
  }

  canAny(ps: Permission[]): boolean {
    return ps.some((p) => this.can(p));
  }

  private set(u: SessionUser | null): void {
    this._user.set(u);
    this.store.write(u);
  }

  /** Una sesión guardada por la v1 (sin `kind`) no sirve contra la API v2. */
  private read(): SessionUser | null {
    const u = this.store.read();
    return u?.kind ? u : null;
  }
}
