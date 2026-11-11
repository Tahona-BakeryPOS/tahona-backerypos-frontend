import { Injectable, computed, signal } from '@angular/core';
import { AuthSessionDto, CompanySummary } from '../api/api.models';
import { LocalStore } from '../storage/local-store';
import { Perm, Permission } from './permissions';

/** Backoffice: email + password, with a refresh token. Register: paired device + PIN, no refresh. */
export type SessionKind = 'backoffice' | 'pos';

export interface SessionUser {
  kind: SessionKind;
  id: string;
  name: string;
  permissions: string[];
  token: string;
  expiresAt: string;
  refreshToken: string | null;
  /** The token's company; null while one still has to be chosen or in the platform session. */
  companyId: string | null;
  companies: CompanySummary[];
  mustChangePassword: boolean;
  isPlatformAdmin: boolean;
}

/**
 * Open session. It lives in sessionStorage: it survives reloading the tab, but not closing it
 * (the register is shared and the backoffice refresh token must not stay on the device).
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
  /** Role shown in the bar: the API does not return the session's role, it is deduced from the permissions. */
  readonly roleLabel = computed(() => {
    const p = this._user()?.permissions ?? [];
    if (p.includes(Perm.platformAdmin)) return 'Plataforma';
    if (p.includes(Perm.organizationManage)) return 'Administrador';
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

  /** A session stored by the previous system (without `kind`) is useless against the current API. */
  private read(): SessionUser | null {
    const u = this.store.read();
    return u?.kind ? u : null;
  }
}
