import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OpenShift, ShiftStore } from '../../core/shift/shift.store';
import { newIdempotencyKey } from '../../core/api/api-client';
import { toApiError } from '../../core/api/api-error';
import { Perm } from '../../core/auth/permissions';
import { SessionStore } from '../../core/auth/session.store';
import { DeviceConfigStore } from '../../core/device/device-config.store';
import { CopPipe } from '../../shared/cop.pipe';
import { ToastService } from '../../shared/toast.service';

/** US-5.2: open the register declaring the opening cash, or resume the session that is already open on it. */
@Component({
  selector: 'app-open-shift-page',
  imports: [FormsModule, CopPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="center">
      <div class="card panel">
        <div class="cu">Abrir caja</div>
        <p class="muted">Hola, <b>{{ session.user()?.name }}</b> ({{ session.roleLabel() }}) · {{ device.config()?.cashRegisterName }}</p>

        @if (existing(); as s) {
          <h2>Esta caja ya tiene una sesión abierta</h2>
          <p>Lo abrió <b>{{ s.openedBy }}</b> el {{ s.openedAt | date: 'dd/MM HH:mm' }} con {{ s.openingAmount | cop }}.</p>
          <div class="actions">
            <button type="button" class="ghost" (click)="logout()">Salir</button>
            <button type="button" class="primary" style="flex:2" (click)="continue()">Continuar esa sesión</button>
          </div>
        } @else {
          <h2>Abrir caja</h2>
          <div class="field">
            <label for="opening">Efectivo inicial</label>
            <input id="opening" type="number" inputmode="numeric" min="0" step="100" [ngModel]="opening" (ngModelChange)="opening = $event; key = newKey()" />
          </div>
          <div class="quick">
            @for (v of presets; track v) { <button type="button" (click)="opening = v; key = newKey()">{{ v | cop }}</button> }
          </div>
          <p class="err small" role="alert" style="min-height:20px">{{ error() }}</p>
          <div class="actions">
            <button type="button" class="ghost" (click)="logout()">Salir</button>
            <button type="button" class="primary" style="flex:2" (click)="open()" [disabled]="busy() || !canOpen">Abrir caja</button>
          </div>
          @if (!canOpen) { <p class="hint">Tu rol no tiene el permiso turnos.abrir.</p> }
          <p class="hint">Una sola sesión abierta por caja · efectivo inicial ≥ 0</p>
        }
      </div>
    </div>
  `,
})
export class OpenShiftPage {
  protected readonly session = inject(SessionStore);
  protected readonly device = inject(DeviceConfigStore);
  private readonly shifts = inject(ShiftStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly presets = [50000, 100000, 200000];
  protected readonly canOpen = this.session.can(Perm.shiftsOpen);
  protected opening = 100000;
  protected readonly newKey = newIdempotencyKey;
  /** Retrying after a network drop reuses the key: it does not open two sessions. */
  protected key = newIdempotencyKey();
  protected readonly existing = signal<OpenShift | null>(null);
  protected readonly error = signal('');
  protected readonly busy = signal(false);

  constructor() {
    // If the server already has an open shift on this register, resuming it is offered.
    if (this.canOpen) void this.shifts.resume().then((s) => this.existing.set(s)).catch(() => undefined);
  }

  protected async open(): Promise<void> {
    if (!(this.opening >= 0)) return this.error.set('El efectivo inicial debe ser mayor o igual a 0.');
    this.busy.set(true);
    this.error.set('');
    try {
      await this.shifts.open(Number(this.opening), this.key);
      this.toast.show('Caja abierta');
      await this.enterPos();
    } catch (e) {
      const err = toApiError(e);
      if (err.code === 'CASH_SESSION_ALREADY_OPEN') this.existing.set(await this.shifts.resume().catch(() => null));
      else this.error.set(err.message);
    } finally {
      this.busy.set(false);
    }
  }

  protected continue(): Promise<void> {
    this.toast.show('Sesión retomada');
    return this.enterPos();
  }

  protected logout(): void {
    this.shifts.forget();
    this.session.end();
    void this.router.navigate(['/login']);
  }

  private async enterPos(): Promise<void> {
    void this.router.navigate(['/pos']);
  }
}
