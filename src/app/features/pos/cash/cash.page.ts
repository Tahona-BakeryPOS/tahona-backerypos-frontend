import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { CashStore } from '../../../core/shift/cash.store';
import { CopPipe } from '../../../shared/cop.pipe';
import { CashMovementDialog } from './cash-movement.dialog';

const KIND: Record<string, string> = {
  opening: 'apertura', sale_cash: 'venta', change_given: 'cambio', refund_cash: 'reembolso', income: 'ingreso', expense: 'retiro',
};

/** HU-5.3: resumen del cajón (calculado por el servidor) e ingresos/retiros de efectivo. */
@Component({
  selector: 'app-cash-page',
  imports: [CopPipe, DatePipe, CashMovementDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="cu">Caja · ingresos y retiros</div>
      <h2>Caja</h2>
      @if (cash.summary(); as s) {
        <div class="kpis">
          <div class="card kpi"><span>Efectivo inicial</span><b>{{ s.openingAmount | cop }}</b></div>
          <div class="card kpi"><span>Ventas en efectivo (neto)</span><b>{{ s.cashSales - s.changeGiven - s.cashRefunds | cop }}</b></div>
          <div class="card kpi"><span>Ingresos / Retiros</span><b>{{ s.incomes | cop }} / {{ s.expenses | cop }}</b></div>
          <div class="card kpi"><span>Efectivo esperado</span><b class="ok">{{ s.expected | cop }}</b></div>
        </div>
      }
      <div class="row" style="margin-bottom:12px">
        <button type="button" class="primary" (click)="moving.set('income')">＋ Ingreso de efectivo</button>
        <button type="button" (click)="moving.set('expense')">－ Retiro de efectivo</button>
        <button type="button" class="ghost" (click)="cash.load()">Actualizar</button>
      </div>
      @if (cash.loadError(); as e) { <p class="warn small">No se pudo cargar la caja: {{ e }}</p> }
      <div class="card scroll-x">
        <table>
          <thead><tr><th>Hora</th><th>Tipo</th><th>Motivo</th><th>Quién</th><th class="num">Monto</th></tr></thead>
          <tbody>
            @for (m of cash.movements(); track m.id) {
              <tr>
                <td>{{ m.occurredAt | date: 'HH:mm' }}</td>
                <td><span class="badge" [class.ok]="m.signedAmount > 0" [class.warn]="m.signedAmount < 0">{{ kind(m.kind) }}</span></td>
                <td>{{ m.reasonName || '—' }}@if (m.note) { <div class="small muted">{{ m.note }}</div> }</td>
                <td>{{ m.userName || '—' }}@if (m.authorizedByName && m.authorizedByName !== m.userName) { <div class="small muted">autorizó {{ m.authorizedByName }}</div> }</td>
                <td class="num">{{ m.signedAmount < 0 ? '−' : '+' }}{{ m.amount | cop }}</td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="empty">Sin movimientos en esta sesión.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
    @if (moving(); as k) { <app-cash-movement-dialog [kind]="k" (closed)="moving.set(null)" /> }
  `,
})
export class CashPage {
  protected readonly cash = inject(CashStore);
  protected readonly moving = signal<'income' | 'expense' | null>(null);

  constructor() {
    void this.cash.load();
  }

  protected kind(k: string): string {
    return KIND[k] ?? k;
  }
}
