import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BACKOFFICE_PERMS } from '../../core/auth/permissions';
import { SessionStore } from '../../core/auth/session.store';
import { DeviceConfigStore } from '../../core/device/device-config.store';
import { CloseShiftDialog } from './cash/close-shift.dialog';

/**
 * Marco del punto de venta: barra superior y navegación (venta, ventas del turno y caja). La v2 vende en
 * línea: el modo sin conexión de la v1 se retiró en la fase 8.
 */
@Component({
  selector: 'app-pos-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CloseShiftDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host { height: 100%; display: flex; flex-direction: column; }
    .top { display: flex; align-items: center; gap: 10px; padding: 8px max(12px, env(safe-area-inset-right, 0px)) 8px max(12px, env(safe-area-inset-left, 0px)); background: var(--surface); border-bottom: 1px solid var(--line); flex-wrap: wrap; }
    .brand { font-weight: 800; color: var(--brand); }
    .who { line-height: 1.2; }
    nav { display: flex; gap: 6px; flex: 1; overflow-x: auto; min-width: 0; }
    nav a, nav button { min-height: 40px; padding: 0 12px; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px;
      border: 1px solid var(--line); border-radius: 12px; color: inherit; text-decoration: none; background: var(--surface); }
    nav a.active { background: var(--brand); color: var(--brand-ink); border-color: var(--brand); }
    .soon { min-height: 40px; padding: 0 12px; display: inline-flex; align-items: center; color: var(--muted); white-space: nowrap; }
    main { flex: 1; min-height: 0; display: flex; }
  `,
  template: `
    <header class="top">
      <span class="brand">🥐 BakeryPOS</span>
      <div class="who small">
        <b>{{ device.config()?.cashRegisterName }}</b><br />
        <span class="muted">{{ session.user()?.name }} · {{ session.roleLabel() }}</span>
      </div>
      <nav aria-label="Secciones del punto de venta">
        <a routerLink="venta" routerLinkActive="active">Venta</a>
        <a routerLink="ventas" routerLinkActive="active">Ventas del turno</a>
        <a routerLink="caja" routerLinkActive="active">Caja</a>
        <button type="button" (click)="closing.set(true)">Cerrar caja</button>
        @if (session.canAny(backofficePerms)) { <a routerLink="/backoffice">Backoffice</a> }
      </nav>
      <button type="button" class="ghost" (click)="logout()">Salir</button>
    </header>
    <main><router-outlet /></main>
    @if (closing()) { <app-close-shift-dialog (closed)="closing.set(false)" /> }
  `,
})
export class PosShellComponent {
  protected readonly session = inject(SessionStore);
  protected readonly device = inject(DeviceConfigStore);
  private readonly router = inject(Router);
  protected readonly backofficePerms = BACKOFFICE_PERMS;
  protected readonly closing = signal(false);

  /** Salir cierra la sesión del cajero, no la de la caja: otro cajero puede continuar. */
  protected logout(): void {
    this.session.end();
    void this.router.navigate(['/login']);
  }
}
