import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { PosProduct } from '../../../core/api/api.models';
import { lineAmounts, round2 } from '../../../core/domain/sale-math';
import { CopPipe } from '../../../shared/cop.pipe';
import { ModalComponent } from '../../../shared/modal.component';

/** Product by weight or volume: the quantity accepts decimals (at most 2, which the electronic invoice accepts). */
@Component({
  selector: 'app-weight-dialog',
  imports: [CopPipe, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [title]="product().name" eyebrow="Producto por peso" (closed)="closed.emit()">
      <div class="field">
        <label for="kg">Cantidad ({{ product().unitCode }})</label>
        <input id="kg" type="number" inputmode="decimal" min="0" step="0.01" [value]="kg()" (input)="kg.set(round2(+$any($event.target).value))" />
      </div>
      <div class="quick">
        @for (v of presets; track v) { <button type="button" (click)="kg.set(v)">{{ v }} {{ product().unitCode }}</button> }
      </div>
      <p>{{ product().price | cop }}/{{ product().unitCode }} · Total: <b>{{ total() | cop }}</b></p>
      @if (kg() <= 0) { <p class="err small">La cantidad debe ser mayor a 0.</p> }
      <div class="actions">
        <button type="button" (click)="closed.emit()">Cancelar</button>
        <button type="button" class="primary" (click)="weighed.emit(kg())" [disabled]="!(kg() > 0)">Agregar</button>
      </div>
    </app-modal>
  `,
})
export class WeightDialog {
  readonly product = input.required<PosProduct>();
  protected readonly round2 = round2;
  readonly closed = output<void>();
  readonly weighed = output<number>();

  protected readonly presets = [0.25, 0.5, 1, 1.5];
  protected readonly kg = signal(0.5);
  protected readonly total = computed(() =>
    lineAmounts({ quantity: this.kg() || 0, unitPrice: this.product().price, priceIncludesTax: this.product().priceIncludesTax, discountAmount: 0, taxRate: this.product().taxRate }).total,
  );
}
