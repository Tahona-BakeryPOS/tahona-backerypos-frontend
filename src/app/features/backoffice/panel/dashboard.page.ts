import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BackofficeApi } from '../../../core/api/backoffice-api';
import { toApiError } from '../../../core/api/api-error';
import { CopPipe } from '../../../shared/cop.pipe';
import { daysAgo } from '../../../shared/date-range.component';
import { BO_PAGE_STYLES } from '../backoffice.styles';

/** Dashboard: what the owner looks at first every day (today's sales, open registers, cash differences). */
@Component({
  selector: 'app-dashboard-page',
  imports: [CopPipe, DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: BO_PAGE_STYLES,
  template: `
    <div class="head">
      <div><h1>Panel de control</h1><p>Ventas de hoy, cajas abiertas y diferencias de caja de la última semana.</p></div>
    </div>

    @if (today.error(); as e) { <p class="err">{{ msg(e) }}</p> }
    <div class="kpis">
      <div class="card kpi"><span>Vendido hoy (neto)</span><b>{{ (today.value()?.netSold ?? 0) | cop }}</b></div>
      <div class="card kpi"><span>Tickets hoy</span><b>{{ today.value()?.salesCount ?? 0 }}</b></div>
      <div class="card kpi"><span>Ticket promedio</span><b>{{ avgTicket() | cop }}</b></div>
      <div class="card kpi"><span>Anuladas / devuelto hoy</span>
        <b [class.neg]="!!today.value()?.voidedCount || !!today.value()?.totalReturned">{{ today.value()?.voidedCount ?? 0 }} · {{ (today.value()?.totalVoided ?? 0) | cop }} / {{ (today.value()?.totalReturned ?? 0) | cop }}</b></div>
    </div>

    <div class="grid-2">
      <section class="card pad">
        <h2>Sucursales</h2>
        <table>
          <thead><tr><th>Sede</th><th class="num">Vendido hoy</th><th>Cajas abiertas</th></tr></thead>
          <tbody>
            @for (b of branchRows(); track b.id) {
              <tr><td>{{ b.name }}</td><td class="num">{{ b.sold | cop }}</td><td>{{ b.open }}</td></tr>
            } @empty { <tr><td colspan="3" class="state">{{ branches.isLoading() ? 'Cargando…' : 'Sin sucursales' }}</td></tr> }
          </tbody>
        </table>
        <a routerLink="../informes/ventas" class="small">Ver el informe de ventas →</a>
      </section>

      <section class="card pad">
        <h2>Diferencias de caja · 7 días</h2>
        <table>
          <thead><tr><th>Cierre</th><th>Caja</th><th class="num">Diferencia</th></tr></thead>
          <tbody>
            @for (s of differences(); track s.id) {
              <tr>
                <td>{{ s.closedAt | date: 'dd/MM HH:mm' }}</td>
                <td>{{ s.branchName }} · {{ s.cashRegisterName }}<div class="small muted">{{ s.closedByName }}</div></td>
                <td class="num" [class.neg]="(s.difference ?? 0) < 0" [class.pos]="(s.difference ?? 0) > 0">{{ s.difference | cop }}</td>
              </tr>
            } @empty { <tr><td colspan="3" class="state">{{ shifts.isLoading() ? 'Cargando…' : 'Sin diferencias: todas las cajas cuadraron.' }}</td></tr> }
          </tbody>
        </table>
        <a routerLink="../ventas/cierres" class="small">Ver todos los cierres →</a>
      </section>
    </div>
  `,
})
export class DashboardPage {
  private readonly bo = inject(BackofficeApi);

  protected readonly today = resource({ loader: () => this.bo.salesReport({ from: daysAgo(0), to: daysAgo(0) }) });
  protected readonly branches = resource({ loader: () => this.bo.branches() });
  protected readonly shifts = resource({ loader: () => this.bo.cashSessions({ from: daysAgo(6), to: daysAgo(0) }, 'closed') });
  /** A session may have been open for days: 30 days are looked at. */
  protected readonly open = resource({ loader: () => this.bo.cashSessions({ from: daysAgo(30), to: daysAgo(0) }, 'open') });

  protected readonly avgTicket = computed(() => {
    const r = this.today.value();
    return r && r.salesCount ? r.totalSold / r.salesCount : 0;
  });

  protected readonly branchRows = computed(() => {
    const sold = new Map((this.today.value()?.branchBreakdown ?? []).map((b) => [b.branchId, b.totalSold - b.totalReturned]));
    const open = this.open.value() ?? [];
    return (this.branches.value() ?? []).filter((b) => b.isActive).map((b) => ({
      id: b.id, name: b.name, sold: sold.get(b.id) ?? 0, open: open.filter((s) => s.branchId === b.id).length,
    }));
  });

  protected readonly differences = computed(() => (this.shifts.value() ?? []).filter((s) => s.difference));

  protected msg(e: unknown): string {
    return toApiError(e).message;
  }
}
