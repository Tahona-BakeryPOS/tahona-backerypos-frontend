import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SaleDto } from '../../../core/api/api.models';
import { BackofficeApi } from '../../../core/api/backoffice-api';
import { toApiError } from '../../../core/api/api-error';
import { AsyncAction } from '../../../shared/async-action';
import { CopPipe } from '../../../shared/cop.pipe';
import { DateRangeComponent, daysAgo } from '../../../shared/date-range.component';
import { ModalComponent } from '../../../shared/modal.component';
import { BO_PAGE_STYLES } from '../backoffice.styles';

const PAGE_SIZE = 50;
const STATUS: Record<string, string> = {
  draft: 'borrador', pending_payment: 'pago pendiente', confirmed: 'confirmada', cancelled: 'cancelada', voided: 'anulada',
};
const FISCAL: Record<string, string> = {
  not_required: 'sin factura', pending: 'en trámite', accepted: 'aceptada', rejected: 'rechazada', in_review: 'sin confirmar', cancelled: 'sin efecto',
};

/**
 * Ventas y caja → Sales: query by dates, branch and status, with the detail of lines, payments and invoice.
 * Each sale has its separate states (sale, payment, inventory, invoice). The void arrives in phase 9 (D-11).
 */
@Component({
  selector: 'app-sales-page',
  imports: [DatePipe, FormsModule, CopPipe, DateRangeComponent, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: BO_PAGE_STYLES,
  template: `
    <div class="head"><div><h1>Ventas</h1><p>Ventas de todas las cajas. Las canceladas nunca se cobraron; las pendientes esperan un pago.</p></div></div>
    <div class="toolbar">
      <app-date-range [(from)]="from" [(to)]="to" />
      <select [ngModel]="branchId()" (ngModelChange)="branchId.set($event); page.set(1)" aria-label="Sucursal">
        <option value="">Todas las sucursales</option>
        @for (b of branches.value() ?? []; track b.id) { <option [value]="b.id">{{ b.name }}</option> }
      </select>
      <select [ngModel]="status()" (ngModelChange)="status.set($event); page.set(1)" aria-label="Estado">
        <option value="">Todos los estados</option>
        @for (s of statuses; track s[0]) { <option [value]="s[0]">{{ s[1] }}</option> }
      </select>
    </div>
    @if (sales.error(); as e) { <p class="err">{{ msg(e) }}</p> }
    <div class="card scroll-x">
      <table>
        <thead><tr><th>N°</th><th>Fecha</th><th>Cajero</th><th>Cliente</th><th class="num">Productos</th><th class="num">Total</th><th>Estado</th><th>Factura</th><th></th></tr></thead>
        <tbody>
          @for (s of sales.value()?.items ?? []; track s.id) {
            <tr>
              <td>{{ s.number ?? '—' }}</td>
              <td style="white-space:nowrap">{{ s.createdAt | date: 'dd/MM HH:mm' }}</td>
              <td>{{ s.cashierName ?? '—' }}</td>
              <td>{{ s.customerIdentification ?? 'Consumidor final' }}</td>
              <td class="num">{{ s.lineCount }}</td>
              <td class="num">{{ s.total | cop }}</td>
              <td><span class="badge" [class.ok]="s.status === 'confirmed'" [class.warn]="s.status === 'pending_payment'" [class.err]="s.status === 'voided'">{{ label(s.status) }}</span></td>
              <td>{{ fiscal(s.fiscalStatus) }}</td>
              <td><button type="button" class="sm" (click)="open(s.id)">Detalle</button></td>
            </tr>
          } @empty { <tr><td colspan="9" class="state">{{ sales.isLoading() ? 'Cargando…' : 'Sin ventas en el rango.' }}</td></tr> }
        </tbody>
      </table>
    </div>
    @if (sales.value(); as r) {
      <div class="pager">
        <span>{{ r.totalCount }} ventas</span>
        <button type="button" class="sm" (click)="page.set(page() - 1)" [disabled]="page() <= 1">Anterior</button>
        <button type="button" class="sm" (click)="page.set(page() + 1)" [disabled]="page() * pageSize >= r.totalCount">Siguiente</button>
      </div>
    }
    @if (action.error()) { <p class="err" role="alert">{{ action.error() }}</p> }

    @if (detail(); as d) {
      <app-modal [title]="'Venta ' + (d.number ?? '(sin número)')" [eyebrow]="label(d.status) + ' · ' + (d.createdAt | date: 'dd/MM/yyyy HH:mm')" (closed)="detail.set(null)">
        <p class="small">Cajero {{ d.cashierName }} · Cliente {{ d.customerIdentification ?? 'Consumidor final' }} · Pago {{ d.paymentStatus }} · Inventario {{ d.inventoryStatus }}</p>
        <table>
          <thead><tr><th>Producto</th><th class="num">Cant.</th><th class="num">Precio</th><th class="num">Desc.</th><th class="num">Impuesto</th><th class="num">Total</th></tr></thead>
          <tbody>@for (l of d.lines; track l.id) {
            <tr><td>{{ l.description }}@if (l.discountReason) { <div class="small muted">{{ l.discountReason }}</div> }</td><td class="num">{{ l.quantity }}</td>
              <td class="num">{{ l.unitPrice | cop }}</td><td class="num">{{ l.discountAmount | cop }}</td><td class="num">{{ l.taxAmount | cop }}</td><td class="num">{{ l.lineTotal | cop }}</td></tr>
          }</tbody>
        </table>
        <div class="sum-row"><span>Base</span><span>{{ d.subtotal | cop }}</span></div>
        <div class="sum-row"><span>Impuestos</span><span>{{ d.taxTotal | cop }}</span></div>
        <div class="sum-row"><b>Total</b><b>{{ d.total | cop }}</b></div>
        <h3 style="font-size:15px;margin-top:10px">Pagos</h3>
        @for (p of d.payments; track p.id) {
          <div class="sum-row"><span>{{ p.methodName }}@if (p.reference) { · {{ p.reference }} }</span><span>{{ p.amount | cop }} · {{ p.status }}</span></div>
        } @empty { <p class="small muted">Sin pagos.</p> }
        <h3 style="font-size:15px;margin-top:10px">Factura electrónica</h3>
        @if (d.fiscal; as f) {
          <p class="small">{{ f.prefix }}{{ f.number }} · {{ f.status }}@if (f.cufe) { <br />CUFE {{ f.cufe }} }@if (f.errors) { <br /><span class="err">{{ f.errors }}</span> }</p>
        } @else { <p class="small muted">{{ fiscal(d.fiscalStatus) }}</p> }
        @if (d.voidedAt) {
          <h3 style="font-size:15px;margin-top:10px">Anulación</h3>
          <p class="small">{{ d.voidedAt | date: 'dd/MM/yyyy HH:mm' }} · autorizó {{ d.voidedByName ?? '—' }} · {{ d.voidReason }}</p>
        }
        @if (d.returns.length) {
          <h3 style="font-size:15px;margin-top:10px">Devoluciones</h3>
          @for (r of d.returns; track r.id) {
            <p class="small"><b>{{ r.occurredAt | date: 'dd/MM HH:mm' }} · {{ r.total | cop }}</b> · autorizó {{ r.approvedByName ?? '—' }} · {{ r.reason }}<br />
              @for (l of r.lines; track l.saleLineId) { {{ l.quantity }} {{ l.description }}@if (!l.restock) { (no reingresa)}; }</p>
          }
        }
        @if (d.creditNotes.length) {
          <h3 style="font-size:15px;margin-top:10px">Notas crédito</h3>
          @for (n of d.creditNotes; track n.id) {
            <p class="small">{{ n.reason === 2 ? 'Anulación' : 'Devolución' }} · {{ n.total | cop }} · {{ n.prefix }}{{ n.number }} {{ n.status }}@if (n.errors) { <br /><span class="err">{{ n.errors }}</span> }</p>
          }
        }
        <div class="actions"><button type="button" class="primary" (click)="detail.set(null)">Cerrar</button></div>
      </app-modal>
    }
  `,
})
export class SalesPage {
  private readonly bo = inject(BackofficeApi);
  protected readonly action = new AsyncAction();
  protected readonly statuses = Object.entries(STATUS);
  protected readonly pageSize = PAGE_SIZE;
  protected readonly from = signal(daysAgo(6));
  protected readonly to = signal(daysAgo(0));
  protected readonly branchId = signal('');
  protected readonly status = signal('');
  protected readonly page = signal(1);
  protected readonly detail = signal<SaleDto | null>(null);
  protected readonly branches = resource({ loader: () => this.bo.branches() });
  protected readonly sales = resource({
    params: () => ({ from: this.from(), to: this.to(), branchId: this.branchId() || null, status: this.status() || null, page: this.page() }),
    loader: ({ params: p }) => this.bo.salesV2({ from: p.from, to: p.to, branchId: p.branchId }, p.status, p.page, PAGE_SIZE),
  });

  protected label(s: string): string {
    return STATUS[s] ?? s;
  }

  protected fiscal(s: string): string {
    return FISCAL[s] ?? s;
  }

  protected async open(id: string): Promise<void> {
    const d = await this.action.run(() => this.bo.saleV2(id));
    if (d) this.detail.set(d);
  }

  protected msg(e: unknown): string {
    return toApiError(e).message;
  }
}
