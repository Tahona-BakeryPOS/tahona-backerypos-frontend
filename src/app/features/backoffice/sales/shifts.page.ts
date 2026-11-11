import { ChangeDetectionStrategy, Component, computed, inject, input, resource, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BackofficeApi } from '../../../core/api/backoffice-api';
import { toApiError } from '../../../core/api/api-error';
import { CopPipe } from '../../../shared/cop.pipe';
import { DateRangeComponent, daysAgo } from '../../../shared/date-range.component';
import { BO_PAGE_STYLES } from '../backoffice.styles';

/**
 * Ventas y caja → Shifts and Closings (US-5.4). The same view with two modes (route data):
 * "shifts" shows all sessions; "closings" only the closed ones, with expected, counted and difference.
 */
@Component({
  selector: 'app-shifts-page',
  imports: [DatePipe, CopPipe, DateRangeComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: BO_PAGE_STYLES,
  template: `
    <div class="head"><div>
      <h1>{{ closedOnly() ? 'Cierres de caja' : 'Turnos' }}</h1>
      <p>{{ closedOnly()
        ? 'Diferencia = efectivo contado − esperado (inicial + ventas en efectivo − cambio − devoluciones + ingresos − retiros).'
        : 'Sesiones de caja abiertas y cerradas, por fecha de apertura.' }}</p>
    </div></div>
    <div class="toolbar">
      <app-date-range [(from)]="from" [(to)]="to" />
      <select [ngModel]="branchId()" (ngModelChange)="branchId.set($event)" aria-label="Sucursal">
        <option value="">Todas las sucursales</option>
        @for (b of branches.value() ?? []; track b.id) { <option [value]="b.id">{{ b.name }}</option> }
      </select>
    </div>
    @if (closedOnly() && sessions.value()) {
      <div class="kpis">
        <div class="card kpi"><span>Cierres</span><b>{{ summary().count }}</b></div>
        <div class="card kpi"><span>Con diferencia</span><b [class.neg]="summary().withDiff">{{ summary().withDiff }}</b></div>
        <div class="card kpi"><span>Diferencia neta</span><b [class.neg]="summary().net < 0" [class.pos]="summary().net > 0">{{ summary().net | cop }}</b></div>
      </div>
    }
    @if (sessions.error(); as e) { <p class="err">{{ msg(e) }}</p> }
    <div class="card scroll-x">
      <table>
        <thead><tr>
          <th>Caja</th><th>Apertura</th><th>Cierre</th><th class="num">Inicial</th>
          <th class="num">Esperado</th><th class="num">Contado</th><th class="num">Diferencia</th>@if (!closedOnly()) { <th>Estado</th> }
        </tr></thead>
        <tbody>
          @for (s of sessions.value() ?? []; track s.id) {
            <tr>
              <td><b>{{ s.cashRegisterName }}</b><div class="small muted">{{ s.branchName }}</div></td>
              <td>{{ s.openedAt | date: 'dd/MM HH:mm' }}<div class="small muted">{{ s.openedByName }}</div></td>
              <td>@if (s.closedAt) { {{ s.closedAt | date: 'dd/MM HH:mm' }}<div class="small muted">{{ s.closedByName }}</div> } @else { — }</td>
              <td class="num">{{ s.openingAmount | cop }}</td>
              <td class="num">{{ s.expectedAmount === null ? '—' : (s.expectedAmount | cop) }}</td>
              <td class="num">{{ s.countedAmount === null ? '—' : (s.countedAmount | cop) }}
                @if (s.notes) { <div class="small muted">{{ s.notes }}</div> }</td>
              <td class="num" [class.neg]="(s.difference ?? 0) < 0" [class.pos]="(s.difference ?? 0) > 0">{{ s.difference === null ? '—' : (s.difference | cop) }}</td>
              @if (!closedOnly()) { <td><span class="badge" [class.warn]="s.status !== 'closed'">{{ s.status === 'closed' ? 'cerrada' : 'abierta' }}</span></td> }
            </tr>
          } @empty { <tr><td [attr.colspan]="closedOnly() ? 7 : 8" class="state">{{ sessions.isLoading() ? 'Cargando…' : 'Sin sesiones en el rango.' }}</td></tr> }
        </tbody>
      </table>
    </div>
  `,
})
export class ShiftsPage {
  private readonly bo = inject(BackofficeApi);
  /** Route data (withComponentInputBinding): 'closings' shows only closed sessions. */
  readonly mode = input<'shifts' | 'closings'>('shifts');
  protected readonly closedOnly = computed(() => this.mode() === 'closings');
  protected readonly from = signal(daysAgo(6));
  protected readonly to = signal(daysAgo(0));
  protected readonly branchId = signal('');

  protected readonly branches = resource({ loader: () => this.bo.branches() });
  protected readonly sessions = resource({
    params: () => ({ from: this.from(), to: this.to(), branchId: this.branchId() || null, closed: this.closedOnly() }),
    loader: ({ params: p }) => this.bo.cashSessions({ from: p.from, to: p.to, branchId: p.branchId }, p.closed ? 'closed' : null),
  });

  protected readonly summary = computed(() => {
    const rows = this.sessions.value() ?? [];
    return {
      count: rows.length,
      withDiff: rows.filter((s) => s.difference).length,
      net: rows.reduce((a, s) => a + (s.difference ?? 0), 0),
    };
  });

  protected msg(e: unknown): string {
    return toApiError(e).message;
  }
}
