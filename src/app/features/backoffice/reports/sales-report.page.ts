import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BackofficeApi } from '../../../core/api/backoffice-api';
import { toApiError } from '../../../core/api/api-error';
import { CopPipe } from '../../../shared/cop.pipe';
import { DateRangeComponent, daysAgo } from '../../../shared/date-range.component';
import { BO_PAGE_STYLES } from '../backoffice.styles';

/**
 * Informes → Sales: by day, branch, payment method and best-selling products. Voided ones do not add up; returns are
 * subtracted for the net. Colombian days.
 */
@Component({
  selector: 'app-sales-report-page',
  imports: [DatePipe, FormsModule, CopPipe, DateRangeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [BO_PAGE_STYLES, `
    .bar { height: 10px; border-radius: 99px; background: color-mix(in srgb, var(--brand) 75%, transparent); min-width: 2px; }
    td.bar-cell { width: 35%; }
  `],
  template: `
    <div class="head"><div><h1>Informe de ventas</h1><p>Vendido por día, sucursal y medio de pago. Las anuladas van aparte; las devoluciones se restan del neto.</p></div></div>
    <div class="toolbar">
      <app-date-range [(from)]="from" [(to)]="to" />
      <select [ngModel]="branchId()" (ngModelChange)="branchId.set($event)" aria-label="Sucursal">
        <option value="">Todas las sucursales</option>
        @for (b of branches.value() ?? []; track b.id) { <option [value]="b.id">{{ b.name }}</option> }
      </select>
    </div>
    @if (report.error(); as e) { <p class="err">{{ msg(e) }}</p> }
    @if (report.value(); as r) {
      <div class="kpis">
        <div class="card kpi"><span>Vendido</span><b>{{ r.totalSold | cop }}</b></div>
        <div class="card kpi"><span>Devuelto</span><b [class.neg]="!!r.totalReturned">{{ r.returnsCount }} · {{ r.totalReturned | cop }}</b></div>
        <div class="card kpi"><span>Neto</span><b>{{ r.netSold | cop }}</b></div>
        <div class="card kpi"><span>Tickets · promedio</span><b>{{ r.salesCount }} · {{ (r.salesCount ? r.totalSold / r.salesCount : 0) | cop }}</b></div>
        <div class="card kpi"><span>Anuladas (aparte)</span><b class="neg">{{ r.voidedCount }} · {{ r.totalVoided | cop }}</b></div>
        <div class="card kpi"><span>Impuestos</span><b>{{ r.taxTotal | cop }}</b></div>
      </div>
      <div class="grid-2">
        <section class="card pad scroll-x">
          <h2>Por día</h2>
          <table>
            <thead><tr><th>Fecha</th><th class="num">Tickets</th><th class="num">Vendido</th><th class="num">Devuelto</th><th></th></tr></thead>
            <tbody>
              @for (d of r.days; track d.date) {
                <tr><td>{{ d.date | date: 'EEE dd/MM' }}</td><td class="num">{{ d.salesCount }}</td><td class="num">{{ d.totalSold | cop }}</td>
                  <td class="num">{{ d.totalReturned ? (d.totalReturned | cop) : '' }}</td>
                  <td class="bar-cell"><div class="bar" [style.width.%]="share(d.totalSold)"></div></td></tr>
              }
            </tbody>
          </table>
        </section>
        <section class="card pad scroll-x">
          <h2>Por sucursal</h2>
          <table>
            <thead><tr><th>Sede</th><th class="num">Tickets</th><th class="num">Vendido</th><th class="num">Devuelto</th><th class="num">Anulado</th></tr></thead>
            <tbody>
              @for (b of r.branchBreakdown; track b.branchId) {
                <tr><td>{{ b.branchName }}</td><td class="num">{{ b.salesCount }}</td><td class="num">{{ b.totalSold | cop }}</td>
                  <td class="num">{{ b.totalReturned | cop }}</td><td class="num">{{ b.totalVoided | cop }}</td></tr>
              } @empty { <tr><td colspan="5" class="state">Sin ventas en el rango.</td></tr> }
            </tbody>
          </table>
        </section>
        <section class="card pad scroll-x">
          <h2>Por medio de pago</h2>
          <table>
            <thead><tr><th>Medio</th><th class="num">Cobrado</th><th class="num">Reembolsado</th><th class="num">Neto</th></tr></thead>
            <tbody>
              @for (m of r.paymentMethods; track m.paymentMethodId) {
                <tr><td>{{ m.methodName }}</td><td class="num">{{ m.approved | cop }}</td><td class="num">{{ m.refunded | cop }}</td><td class="num">{{ m.net | cop }}</td></tr>
              } @empty { <tr><td colspan="4" class="state">Sin pagos en el rango.</td></tr> }
            </tbody>
          </table>
          <p class="small muted">Los reembolsos se pagan en efectivo de la caja (D-11), aunque el pago original haya sido con datáfono.</p>
        </section>
        <section class="card pad scroll-x">
          <h2>Productos más vendidos</h2>
          <table>
            <thead><tr><th>Producto</th><th class="num">Cantidad</th><th class="num">Vendido</th></tr></thead>
            <tbody>
              @for (p of r.topProducts; track p.productId + p.name) {
                <tr><td>{{ p.name }}</td><td class="num">{{ p.quantity }}</td><td class="num">{{ p.total | cop }}</td></tr>
              } @empty { <tr><td colspan="3" class="state">Sin ventas en el rango.</td></tr> }
            </tbody>
          </table>
        </section>
      </div>
    } @else if (report.isLoading()) { <p class="state">Cargando…</p> }
  `,
})
export class SalesReportPage {
  private readonly bo = inject(BackofficeApi);
  protected readonly from = signal(daysAgo(6));
  protected readonly to = signal(daysAgo(0));
  protected readonly branchId = signal('');
  protected readonly branches = resource({ loader: () => this.bo.branches() });
  protected readonly report = resource({
    params: () => ({ from: this.from(), to: this.to(), branchId: this.branchId() || null }),
    loader: ({ params: p }) => this.bo.salesReport(p),
  });
  private readonly maxDay = computed(() => Math.max(1, ...(this.report.value()?.days ?? []).map((d) => d.totalSold)));

  protected share(v: number): number {
    return (v / this.maxDay()) * 100;
  }

  protected msg(e: unknown): string {
    return toApiError(e).message;
  }
}
