import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SaleDto } from '../../../core/api/api.models';
import { PosApi } from '../../../core/api/pos-api';
import { toApiError } from '../../../core/api/api-error';
import { ShiftStore } from '../../../core/shift/shift.store';
import { CopPipe } from '../../../shared/cop.pipe';
import { ToastService } from '../../../shared/toast.service';
import { ReceiptDialog } from '../sell/receipt.dialog';
import { ReturnSaleDialog } from './return-sale.dialog';
import { VoidSaleDialog } from './void-sale.dialog';

const STATUS: Record<string, string> = {
  draft: 'borrador', pending_payment: 'pago pendiente', confirmed: 'confirmada', cancelled: 'cancelada', voided: 'anulada',
};
const FISCAL: Record<string, string> = {
  not_required: '—', pending: 'en trámite', accepted: 'aceptada', rejected: 'rechazada', in_review: 'sin confirmar', cancelled: 'cancelada',
};

/**
 * Ventas de la sesión de caja abierta, con su estado de pago y de factura. Una venta del turno se anula (D-11); una de
 * cualquier turno se devuelve total o parcialmente (se busca por número).
 */
@Component({
  selector: 'app-shift-sales-page',
  imports: [CopPipe, DatePipe, FormsModule, ReceiptDialog, ReturnSaleDialog, VoidSaleDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="row">
        <h2 class="grow">Ventas del turno</h2>
        <input type="number" inputmode="numeric" min="1" placeholder="Venta N°" aria-label="Buscar venta por número para devolución"
          style="width:120px" [(ngModel)]="lookup" (keyup.enter)="find()" />
        <button type="button" class="ghost" (click)="find()">Devolver otra venta</button>
        <button type="button" class="ghost" (click)="sales.reload()">Actualizar</button>
      </div>
      @if (sales.error(); as e) { <p class="err">{{ msg(e) }}</p> }
      @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
      <div class="card scroll-x">
        <table>
          <thead><tr><th>N°</th><th>Hora</th><th>Cliente</th><th class="num">Total</th><th class="num">Devuelto</th><th>Estado</th><th>Factura</th><th></th></tr></thead>
          <tbody>
            @for (s of sales.value()?.items ?? []; track s.id) {
              <tr>
                <td>{{ s.number ?? '—' }}</td>
                <td>{{ s.createdAt | date: 'HH:mm' }}</td>
                <td>{{ s.customerIdentification ?? 'Consumidor final' }}</td>
                <td class="num">{{ s.total | cop }}</td>
                <td class="num">{{ s.refundedTotal ? (s.refundedTotal | cop) : '' }}</td>
                <td><span class="badge" [class.ok]="s.status === 'confirmed'" [class.warn]="s.status === 'pending_payment'" [class.err]="s.status === 'voided'">{{ label(s.status) }}</span></td>
                <td>{{ fiscal(s.fiscalStatus) }}</td>
                <td style="white-space:nowrap">
                  @if (s.status === 'confirmed') {
                    <button type="button" class="sm" (click)="open(s.id, 'receipt')">Comprobante</button>
                    <button type="button" class="sm" (click)="open(s.id, 'return')">Devolver</button>
                    @if (!s.refundedTotal) { <button type="button" class="sm danger" (click)="open(s.id, 'void')">Anular</button> }
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="8" class="empty">{{ sales.isLoading() ? 'Cargando…' : 'Aún no hay ventas en este turno.' }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
    @if (action(); as a) {
      @switch (a.kind) {
        @case ('receipt') { <app-receipt-dialog [sale]="a.sale" (closed)="action.set(null)" /> }
        @case ('void') { <app-void-sale-dialog [sale]="a.sale" (closed)="action.set(null)" (voided)="done('Venta anulada: entrega el efectivo al cliente.')" /> }
        @case ('return') { <app-return-sale-dialog [sale]="a.sale" (closed)="action.set(null)" (returned)="done('Devolución registrada: entrega el efectivo al cliente.')" /> }
      }
    }
  `,
})
export class ShiftSalesPage {
  private readonly api = inject(PosApi);
  private readonly shifts = inject(ShiftStore);
  private readonly toast = inject(ToastService);
  protected readonly action = signal<{ kind: 'receipt' | 'void' | 'return'; sale: SaleDto } | null>(null);
  protected readonly error = signal('');
  protected lookup: number | null = null;
  protected readonly sales = resource({
    params: () => this.shifts.shift()?.id,
    loader: ({ params: id }) => this.api.sessionSales(id),
  });

  protected label(s: string): string {
    return STATUS[s] ?? s;
  }

  protected fiscal(s: string): string {
    return FISCAL[s] ?? s;
  }

  protected async open(id: string, kind: 'receipt' | 'void' | 'return'): Promise<void> {
    this.error.set('');
    try {
      this.action.set({ kind, sale: await this.api.sale(id) });
    } catch (e) {
      this.error.set(toApiError(e).message);
    }
  }

  /** Devolución de una venta de otro turno (D-11: ya no se anula). */
  protected async find(): Promise<void> {
    if (!this.lookup) return;
    this.error.set('');
    try {
      const found = (await this.api.saleByNumber(this.lookup)).items[0];
      if (!found) return this.error.set(`No existe la venta N° ${this.lookup}.`);
      if (found.status !== 'confirmed') return this.error.set(`La venta N° ${this.lookup} está ${this.label(found.status)}: no admite devolución.`);
      await this.open(found.id, 'return');
    } catch (e) {
      this.error.set(toApiError(e).message);
    }
  }

  protected done(message: string): void {
    this.action.set(null);
    this.toast.show(message);
    this.sales.reload();
  }

  protected msg(e: unknown): string {
    return toApiError(e).message;
  }
}
