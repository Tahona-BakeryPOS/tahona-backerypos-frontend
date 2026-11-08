import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CartLine, CartStore } from '../../../core/sales/cart.store';
import { ModalComponent } from '../../../shared/modal.component';

export const DISCOUNT_REASONS = ['Producto del día anterior', 'Cliente frecuente', 'Cortesía', 'Producto con defecto'];

/** CU-03: descuento por línea, en porcentaje (como lo recibe la API) y con motivo obligatorio. */
@Component({
  selector: 'app-discount-dialog',
  imports: [FormsModule, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal title="Descuento" [eyebrow]="line().product.name" (closed)="closed.emit()">
      <div class="field">
        <label for="dPct">Porcentaje de descuento</label>
        <input id="dPct" type="number" inputmode="decimal" min="0" max="100" [(ngModel)]="percent" />
      </div>
      <div class="quick">
        @for (v of [5, 10, 20, 50]; track v) { <button type="button" (click)="percent = v">{{ v }}%</button> }
      </div>
      <div class="field">
        <label for="dReason">Motivo (obligatorio)</label>
        <select id="dReason" [(ngModel)]="reason">
          <option value="">— elegir —</option>
          @for (r of reasons; track r) { <option [value]="r">{{ r }}</option> }
        </select>
      </div>
      <p class="err small" role="alert" style="min-height:18px">{{ error() }}</p>
      <div class="actions">
        @if (line().discountPercent) { <button type="button" (click)="apply(0, '')">Quitar descuento</button> }
        <button type="button" (click)="closed.emit()">Cancelar</button>
        <button type="button" class="primary" (click)="apply(percent, reason)">Aplicar</button>
      </div>
    </app-modal>
  `,
})
export class DiscountDialog {
  private readonly cart = inject(CartStore);
  readonly line = input.required<CartLine>();
  readonly closed = output<void>();

  protected readonly reasons = DISCOUNT_REASONS;
  protected percent = 10;
  protected reason = '';
  protected readonly error = signal('');

  protected apply(percent: number, reason: string): void {
    const pct = Number(percent);
    if (pct > 0 && (!(pct <= 100) || !reason)) {
      this.error.set('El porcentaje debe estar entre 1 y 100 y el motivo es obligatorio.');
      return;
    }
    this.cart.discount(this.line().key, pct, reason || '');
    this.closed.emit();
  }
}
