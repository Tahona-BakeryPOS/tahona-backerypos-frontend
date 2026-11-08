import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { PosApi } from '../../core/api/pos-api';
import { SessionStore } from '../../core/auth/session.store';
import { DeviceConfigStore } from '../../core/device/device-config.store';
import { ShiftStore } from '../../core/shift/shift.store';
import { IconComponent } from '../../shared/icon.component';
import { BACKOFFICE_MENU } from './backoffice-menu';

/** Marco del backoffice: barra lateral por módulos (colapsable en pantallas angostas). */
@Component({
  selector: 'app-backoffice-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host { height: 100%; display: grid; grid-template-columns: 264px minmax(0, 1fr); }
    aside { background: var(--surface); border-right: 1px solid var(--line); overflow-y: auto; display: flex; flex-direction: column;
      padding: 14px 10px max(14px, env(safe-area-inset-bottom, 0px)) max(10px, env(safe-area-inset-left, 0px)); }
    .brand { font-weight: 800; color: var(--brand); padding: 4px 10px 12px; display: flex; justify-content: space-between; align-items: center; }
    .group { margin-bottom: 6px; }
    .group-title { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; padding: 8px 10px; }
    .group-title app-icon { color: var(--brand); }
    a.item, span.item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 10px 7px 38px;
      border-radius: 8px; color: inherit; text-decoration: none; font-size: 14px; }
    a.item:hover { background: var(--surface2); }
    a.item.active { background: color-mix(in srgb, var(--brand) 14%, transparent); color: var(--brand); font-weight: 700; }
    span.item { color: var(--muted); cursor: default; }
    .soon { font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; border: 1px solid var(--line); border-radius: 99px; padding: 1px 6px; }
    .foot { margin-top: auto; padding: 12px 10px 0; border-top: 1px solid var(--line); display: grid; gap: 8px; font-size: 13px; }
    .content { display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: auto; }
    .topbar { display: none; }
    .menu-btn { min-height: 40px; padding: 0 10px; }
    @media (max-width: 900px) {
      :host { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
      .topbar { display: flex; align-items: center; gap: 10px; padding: 8px max(12px, env(safe-area-inset-right, 0px)) 8px max(12px, env(safe-area-inset-left, 0px));
        background: var(--surface); border-bottom: 1px solid var(--line); }
      aside { position: fixed; inset: 0 auto 0 0; width: min(300px, 86vw); z-index: 30; transform: translateX(-100%); transition: transform .2s; box-shadow: var(--shadow); }
      aside.open { transform: none; }
      .scrim { z-index: 25; }
    }
    @media (prefers-reduced-motion: reduce) { aside { transition: none; } }
  `,
  template: `
    <header class="topbar">
      <button type="button" class="ghost menu-btn" (click)="open.set(true)" aria-label="Abrir menú"><app-icon name="menu" /></button>
      <b class="grow" style="color:var(--brand)">BakeryPOS</b>
    </header>
    @if (open()) { <div class="scrim" (click)="open.set(false)"></div> }
    <aside [class.open]="open()" aria-label="Menú del backoffice">
      <div class="brand">
        <span>🥐 BakeryPOS</span>
        @if (open()) { <button type="button" class="ghost menu-btn" (click)="open.set(false)" aria-label="Cerrar menú"><app-icon name="close" /></button> }
      </div>
      <nav>
        @for (g of menu(); track g.label) {
          <div class="group">
            <div class="group-title"><app-icon [name]="g.icon" />{{ g.label }}</div>
            @for (i of g.items; track i.label) {
              @if (i.route) {
                <a class="item" [routerLink]="i.route" routerLinkActive="active">{{ i.label }}</a>
              } @else {
                <span class="item" aria-disabled="true">{{ i.label }} <span class="soon">Próximamente</span></span>
              }
            }
          </div>
        }
      </nav>
      <div class="foot">
        <span><b>{{ session.user()?.name }}</b> · {{ session.roleLabel() }}</span>
        <span class="muted">{{ session.companyName() ?? 'Administración de la plataforma' }}</span>
        @if (canSwitch()) { <a routerLink="/backoffice/ingresar" [queryParams]="{ paso: 'empresa' }">Cambiar de empresa</a> }
        @if (device.isPaired()) {
          <a [routerLink]="shifts.isOpen() ? '/pos' : '/turno'">← Ir a la caja</a>
        }
        <button type="button" class="sm" (click)="logout()">Cerrar sesión</button>
      </div>
    </aside>
    <main class="content"><router-outlet /></main>
  `,
})
export class BackofficeShellComponent {
  protected readonly session = inject(SessionStore);
  protected readonly device = inject(DeviceConfigStore);
  protected readonly shifts = inject(ShiftStore);
  private readonly router = inject(Router);
  private readonly api = inject(PosApi);
  protected readonly open = signal(false);
  protected readonly canSwitch = computed(() => {
    const u = this.session.user();
    return !!u && (u.companies.length > 1 || (u.isPlatformAdmin && u.companies.length > 0));
  });

  /**
   * Solo se muestran los ítems que el rol puede abrir. Los "Próximamente" se ven en las sesiones de
   * empresa; la de plataforma no opera ninguna empresa y solo ve lo suyo.
   */
  protected readonly menu = computed(() => {
    const inCompany = !!this.session.user()?.companyId;
    return BACKOFFICE_MENU.map((g) => ({
      ...g,
      items: g.items.filter((i) => (i.route ? !i.perm || this.session.canAny([i.perm].flat()) : inCompany)),
    })).filter((g) => g.items.length);
  });

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => this.open.set(false));
  }

  /** Revoca el refresh token en el servidor (sin esperar) y cierra la sesión local. */
  protected logout(): void {
    const refresh = this.session.refreshToken();
    if (refresh) void this.api.logout(refresh).catch(() => undefined);
    this.session.end();
    void this.router.navigate(['/backoffice/ingresar']);
  }
}
