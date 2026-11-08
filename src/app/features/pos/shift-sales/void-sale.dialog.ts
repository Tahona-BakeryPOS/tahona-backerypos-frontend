import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SaleDto } from '../../../core/api/api.models';
import { PosApi } from '../../../core/api/pos-api';
import { toApiError } from '../../../core/api/api-error';
import { Perm } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { CopPipe } from '../../../shared/cop.pipe';
import { ModalComponent } from '../../../shared/modal.component';
import { OwnerAuthComponent } from '../../../shared/owner-auth.component';

export const VOID_REASONS = ['Error de digitación', 'Cliente desistió', 'Cobro duplicado', 'Producto equivocado'];

/**
 * D-11: anulación total de una venta del turno abierto. Devuelve todo en efectivo, reversa el inventario y, si la
 * factura ya fue aceptada, emite la nota crédito. Sin el permiso, la autoriza un superior con su PIN.
 */
@Component({
  selector: 'app-void-sale-dialog',
  imports: [FormsModule, CopPipe, ModalComponent, OwnerAuthComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [title]="'Anular venta N° ' + sale().number" eyebrow="Anulación" (closed)="closed.emit()">
      <p class="small">Se devuelven <b>{{ sale().total | cop }}</b> en efectivo de esta caja y los productos vuelven al inventario.
        @if (sale().fiscal) { La factura electrónica se corrige con una nota crédito. }</p>
      <div class="field">
        <label for="vReason">Motivo</label>
        <select id="vReason" [(ngModel)]="preset">
          <option value="">— elegir —</option>
          @for (r of reasons; track r) { <option [value]="r">{{ r }}</option> }
          <option value="other">Otro…</option>
        </select>
      </div>
      @if (preset === 'other') {
        <div class="field"><label for="vOther">Detalle</label><input id="vOther" maxlength="300" [(ngModel)]="other" /></div>
      }
      <p class="err small" role="alert" style="min-height:18px">{{ error() }}</p>
      @if (needsAuthorizer()) {
        <p class="small muted">Las anulaciones las autoriza un superior.</p>
        <app-owner-auth [permission]="perm" (authorized)="submit($event)" />
        <div class="actions"><button type="button" (click)="closed.emit()">Cancelar</button></div>
      } @else {
        <div class="actions">
          <button type="button" (click)="closed.emit()">Cancelar</button>
          <button type="button" class="danger" (click)="submit()" [disabled]="busy()">Anular venta</button>
        </div>
      }
    </app-modal>
  `,
})
export class VoidSaleDialog {
  private readonly api = inject(PosApi);
  private readonly session = inject(SessionStore);

  readonly sale = input.required<SaleDto>();
  readonly closed = output<void>();
  readonly voided = output<SaleDto>();

  protected readonly perm = Perm.ventasAnular;
  protected readonly reasons = VOID_REASONS;
  protected readonly needsAuthorizer = computed(() => !this.session.can(Perm.ventasAnular));
  protected preset = '';
  protected other = '';
  protected readonly error = signal('');
  protected readonly busy = signal(false);

  protected async submit(authorizerToken?: string): Promise<void> {
    const reason = this.preset === 'other' ? this.other.trim() : this.preset;
    if (!reason) return this.error.set('Elige el motivo.');
    this.error.set('');
    this.busy.set(true);
    try {
      this.voided.emit(await this.api.voidSale(this.sale().id, reason, authorizerToken));
    } catch (e) {
      this.error.set(toApiError(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
