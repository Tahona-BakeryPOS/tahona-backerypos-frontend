import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { newIdempotencyKey } from '../../../core/api/api-client';
import { CashSessionDto } from '../../../core/api/api.models';
import { toApiError } from '../../../core/api/api-error';
import { SessionStore } from '../../../core/auth/session.store';
import { round2 } from '../../../core/domain/sale-math';
import { CashStore } from '../../../core/shift/cash.store';
import { ShiftStore } from '../../../core/shift/shift.store';
import { CopPipe } from '../../../shared/cop.pipe';
import { ModalComponent } from '../../../shared/modal.component';

/**
 * HU-5.4: el cajero cuenta el efectivo y ve la diferencia en vivo contra el esperado del servidor.
 * Con pagos pendientes el cierre se bloquea (D-12) hasta resolverlos.
 */
@Component({
  selector: 'app-close-shift-dialog',
  imports: [FormsModule, CopPipe, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (result(); as r) {
      <app-modal title="Caja cerrada" eyebrow="Cierre de caja" (closed)="finish()">
        <div class="sum-row"><span>Esperado</span><b>{{ r.expectedAmount | cop }}</b></div>
        <div class="sum-row"><span>Contado</span><b>{{ r.countedAmount | cop }}</b></div>
        <div class="sum-row"><b>Diferencia</b><b [class.ok]="!r.difference" [class.err]="!!r.difference">{{ r.difference | cop }}</b></div>
        <p class="small muted">Una sesión cerrada no admite ventas ni movimientos.</p>
        <div class="actions"><button type="button" class="primary" (click)="finish()">Salir</button></div>
      </app-modal>
    } @else {
      <app-modal title="Cerrar caja" eyebrow="Cierre de caja" (closed)="closed.emit()">
        @if (cash.summary(); as s) {
          <div class="card pad">
            <div class="sum-row"><span>Efectivo inicial</span><span>{{ s.openingAmount | cop }}</span></div>
            <div class="sum-row"><span>+ Ventas en efectivo</span><span>{{ s.cashSales | cop }}</span></div>
            <div class="sum-row"><span>− Cambio entregado</span><span>{{ s.changeGiven | cop }}</span></div>
            <div class="sum-row"><span>− Efectivo devuelto</span><span>{{ s.cashRefunds | cop }}</span></div>
            <div class="sum-row"><span>+ Ingresos</span><span>{{ s.incomes | cop }}</span></div>
            <div class="sum-row"><span>− Retiros</span><span>{{ s.expenses | cop }}</span></div>
            <div class="sum-row"><b>Efectivo esperado</b><b>{{ s.expected | cop }}</b></div>
          </div>
          @if (s.pendingPayments) {
            <p class="err small">Hay {{ s.pendingPayments }} pago(s) pendiente(s). Resuélvelos antes de cerrar.</p>
          }
        } @else if (cash.loadError(); as e) {
          <p class="warn small">No se pudo cargar el resumen: {{ e }}</p>
        }
        <div class="field">
          <label for="counted">Efectivo contado</label>
          <input id="counted" type="number" inputmode="numeric" min="0" placeholder="Cuenta el efectivo del cajón"
                 [ngModel]="counted()" (ngModelChange)="counted.set($event); renewKey()" />
        </div>
        <div class="sum-row">
          <b>Diferencia</b>
          <b [class.muted]="difference() === null" [class.ok]="difference() === 0" [class.warn]="(difference() ?? 0) > 0" [class.err]="(difference() ?? 0) < 0">
            {{ difference() === null ? '—' : (difference() | cop) }}
          </b>
        </div>
        <div class="field"><label for="notes">Observación (opcional)</label><input id="notes" [ngModel]="notes" (ngModelChange)="notes = $event; renewKey()" maxlength="300" /></div>
        <p class="err small" role="alert" style="min-height:18px">{{ error() }}</p>
        <div class="actions">
          <button type="button" (click)="closed.emit()">Cancelar</button>
          <button type="button" class="primary" (click)="close()" [disabled]="busy() || counted() === null || !!cash.summary()?.pendingPayments">Cerrar caja</button>
        </div>
      </app-modal>
    }
  `,
})
export class CloseShiftDialog {
  protected readonly cash = inject(CashStore);
  private readonly shifts = inject(ShiftStore);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  readonly closed = output<void>();

  protected readonly counted = signal<number | null>(null);
  protected readonly difference = computed(() => {
    const c = this.counted();
    return c === null || (c as unknown) === '' || !this.cash.summary() ? null : round2(Number(c) - this.cash.expected());
  });
  protected notes = '';
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly result = signal<CashSessionDto | null>(null);
  private key = newIdempotencyKey();

  constructor() {
    void this.cash.load();
  }

  protected renewKey(): void {
    this.key = newIdempotencyKey();
  }

  protected async close(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      this.result.set(await this.shifts.close(Number(this.counted()), this.notes.trim() || null, this.key));
    } catch (e) {
      const err = toApiError(e);
      this.error.set(err.message);
      // Otro equipo pudo cerrar o registrar pagos: el resumen se refresca.
      if (err.code === 'PAGO_PENDIENTE' || err.code === 'CAJA_CERRADA') void this.cash.load();
    } finally {
      this.busy.set(false);
    }
  }

  protected finish(): void {
    this.session.end();
    void this.router.navigate(['/login']);
  }
}
