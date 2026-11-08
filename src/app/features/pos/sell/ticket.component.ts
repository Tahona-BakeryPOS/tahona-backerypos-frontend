import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SaleDto } from '../../../core/api/api.models';
import { CartLine, CartStore } from '../../../core/sales/cart.store';
import { CopPipe } from '../../../shared/cop.pipe';
import { DiscountDialog } from './discount.dialog';
import { PaymentDialog } from './payment.dialog';
import { ReceiptDialog } from './receipt.dialog';
import { Perm } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { ToastService } from '../../../shared/toast.service';

/**
 * Venta en curso: líneas, cliente, totales (vista previa) y botón Cobrar. Orquesta los diálogos de descuento,
 * cobro y comprobante; el total que se cobra lo calcula el servidor.
 */
@Component({
  selector: 'app-ticket',
  imports: [CopPipe, FormsModule, DiscountDialog, PaymentDialog, ReceiptDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host { border-left: 1px solid var(--line); background: var(--surface); display: flex; flex-direction: column; min-height: 0; }
    h3 { padding: 12px 14px 0; }
    .lines { flex: 1; overflow: auto; padding: 6px 14px; }
    .line { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 8px; padding: 8px 0; border-bottom: 1px dashed var(--line); }
    .qty { display: flex; align-items: center; gap: 6px; }
    .qty button { min-height: 36px; width: 36px; padding: 0; border-radius: 10px; }
    .totals { padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px)); border-top: 1px solid var(--line); background: var(--surface2); }
    .t { display: flex; justify-content: space-between; font-variant-numeric: tabular-nums; }
    .total { font-size: 26px; font-weight: 800; }
    .pay { flex: 1; min-height: 56px; font-size: 18px; }
    @media (max-width: 900px) { :host { border-left: 0; border-top: 1px solid var(--line); } }
  `,
  template: `
    <h3>Venta actual</h3>
    <div style="padding:4px 14px 0" class="row">
      <label class="small muted grow" for="cust">Cliente (NIT o cédula, vacío = consumidor final)
        <input id="cust" inputmode="numeric" maxlength="15" [ngModel]="cart.customer() ?? ''" (ngModelChange)="cart.setCustomer($event)" placeholder="Consumidor final" />
      </label>
    </div>
    <div class="lines">
      @for (l of cart.lines(); track l.key) {
        <div class="line">
          <div>
            <b>{{ l.product.name }}</b>
            <div class="small muted">
              {{ l.product.price | cop }} · impuesto {{ l.product.taxRate }}%{{ l.product.priceIncludesTax ? ' incluido' : '' }}
              @if (l.discountPercent) { · <span class="warn">desc. {{ l.discountPercent }}% ({{ l.discountReason }})</span> }
            </div>
          </div>
          <div class="bold right">{{ cart.lineTotal(l) | cop }}</div>
          <div class="qty">
            <button type="button" (click)="cart.step(l.key, -1)" aria-label="Quitar uno">−</button>
            <b>{{ l.quantity }}@if (l.product.allowsDecimals) { {{ l.product.unitCode }} }</b>
            <button type="button" (click)="cart.step(l.key, 1)" aria-label="Agregar uno">+</button>
            <button type="button" class="ghost" (click)="askDiscount(l)" title="Descuento" aria-label="Descuento">%</button>
            <button type="button" class="ghost" (click)="cart.remove(l.key)" title="Quitar" aria-label="Quitar línea">🗑</button>
          </div>
        </div>
      } @empty {
        <div class="empty">Toca un producto para agregarlo</div>
      }
    </div>
    <div class="totals">
      <div class="t small muted"><span>Base</span><span>{{ cart.totals().subtotal | cop }}</span></div>
      @if (cart.totals().discount) { <div class="t small muted"><span>Descuentos</span><span>−{{ cart.totals().discount | cop }}</span></div> }
      <div class="t small muted"><span>Impuestos</span><span>{{ cart.totals().tax | cop }}</span></div>
      <div class="t"><span>Total</span><span class="total">{{ cart.totals().total | cop }}</span></div>
      <div class="row" style="margin-top:8px">
        <button type="button" (click)="cart.clear()" [disabled]="cart.isEmpty()">Vaciar</button>
        <button type="button" class="primary pay" (click)="paying.set(true)" [disabled]="cart.isEmpty()">Cobrar {{ cart.totals().total | cop }}</button>
      </div>
    </div>

    @if (discounting(); as l) { <app-discount-dialog [line]="l" (closed)="discounting.set(null)" /> }
    @if (paying()) { <app-payment-dialog (closed)="paying.set(false)" (paid)="onPaid($event)" /> }
    @if (receipt(); as s) { <app-receipt-dialog [sale]="s" (closed)="receipt.set(null)" /> }
  `,
})
export class TicketComponent {
  protected readonly cart = inject(CartStore);
  private readonly session = inject(SessionStore);
  private readonly toast = inject(ToastService);
  protected readonly discounting = signal<CartLine | null>(null);
  protected readonly paying = signal(false);
  protected readonly receipt = signal<SaleDto | null>(null);

  /** HU-6.2: el servidor exige ventas.descuento a quien vende (la autorización por otro usuario queda pendiente, I-25). */
  protected askDiscount(l: CartLine): void {
    if (this.session.can(Perm.ventasDescuento)) this.discounting.set(l);
    else this.toast.show('Tu rol no puede aplicar descuentos (permiso ventas.descuento).');
  }

  protected onPaid(sale: SaleDto): void {
    this.paying.set(false);
    this.cart.clear();
    this.receipt.set(sale);
  }
}
