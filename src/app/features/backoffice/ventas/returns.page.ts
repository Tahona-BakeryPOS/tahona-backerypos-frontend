import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BackofficeApi } from '../../../core/api/backoffice-api';
import { toApiError } from '../../../core/api/api-error';
import { CopPipe } from '../../../shared/cop.pipe';
import { DateRangeComponent, daysAgo } from '../../../shared/date-range.component';
import { BO_PAGE_STYLES } from '../backoffice.styles';

const PAGE_SIZE = 50;
const NOTE: Record<string, string> = {
  pending: 'en trámite', submitting: 'enviando', accepted: 'aceptada', rejected: 'rechazada', temporary_error: 'reintentando',
  unknown: 'sin confirmar', cancelled: 'sin efecto',
};

/**
 * Ventas y caja → Returns (US-9.2): who authorized, reason, money returned in cash and credit-note
 * status. Returns are recorded in the POS (they come out of the open register).
 */
@Component({
  selector: 'app-returns-page',
  imports: [DatePipe, FormsModule, CopPipe, DateRangeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: BO_PAGE_STYLES,
  template: `
    <div class="head"><div><h1>Devoluciones</h1><p>Se registran en el POS con autorización de un superior; el dinero sale en efectivo de la caja.</p></div></div>
    <div class="toolbar">
      <app-date-range [(from)]="from" [(to)]="to" />
      <select [ngModel]="branchId()" (ngModelChange)="branchId.set($event); page.set(1)" aria-label="Sucursal">
        <option value="">Todas las sucursales</option>
        @for (b of branches.value() ?? []; track b.id) { <option [value]="b.id">{{ b.name }}</option> }
      </select>
    </div>
    @if (returns.error(); as e) { <p class="err">{{ msg(e) }}</p> }
    <div class="card scroll-x">
      <table>
        <thead><tr><th>Fecha</th><th>Venta</th><th>Motivo</th><th>Autorizó</th><th class="num">Productos</th><th class="num">Devuelto</th><th>Nota crédito</th></tr></thead>
        <tbody>
          @for (r of returns.value()?.items ?? []; track r.id) {
            <tr>
              <td style="white-space:nowrap">{{ r.occurredAt | date: 'dd/MM HH:mm' }}</td>
              <td>N° {{ r.saleNumber ?? '—' }}</td>
              <td>{{ r.reason }}</td>
              <td>{{ r.approvedByName ?? '—' }}</td>
              <td class="num">{{ r.lineCount }}</td>
              <td class="num">{{ r.total | cop }}</td>
              <td>{{ r.creditNoteStatus ? (note[r.creditNoteStatus] ?? r.creditNoteStatus) : 'sin factura' }}</td>
            </tr>
          } @empty { <tr><td colspan="7" class="state">{{ returns.isLoading() ? 'Cargando…' : 'Sin devoluciones en el rango.' }}</td></tr> }
        </tbody>
      </table>
    </div>
    @if (returns.value(); as r) {
      <div class="pager">
        <span>{{ r.totalCount }} devoluciones</span>
        <button type="button" class="sm" (click)="page.set(page() - 1)" [disabled]="page() <= 1">Anterior</button>
        <button type="button" class="sm" (click)="page.set(page() + 1)" [disabled]="page() * pageSize >= r.totalCount">Siguiente</button>
      </div>
    }
  `,
})
export class ReturnsPage {
  private readonly bo = inject(BackofficeApi);
  protected readonly note = NOTE;
  protected readonly pageSize = PAGE_SIZE;
  protected readonly from = signal(daysAgo(29));
  protected readonly to = signal(daysAgo(0));
  protected readonly branchId = signal('');
  protected readonly page = signal(1);
  protected readonly branches = resource({ loader: () => this.bo.branches() });
  protected readonly returns = resource({
    params: () => ({ from: this.from(), to: this.to(), branchId: this.branchId() || null, page: this.page() }),
    loader: ({ params: p }) => this.bo.saleReturns({ from: p.from, to: p.to, branchId: p.branchId }, p.page, PAGE_SIZE),
  });

  protected msg(e: unknown): string {
    return toApiError(e).message;
  }
}
