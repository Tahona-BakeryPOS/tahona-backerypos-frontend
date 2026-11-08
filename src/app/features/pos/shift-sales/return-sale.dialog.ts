import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SaleDto } from '../../../core/api/api.models';
import { newIdempotencyKey } from '../../../core/api/api-client';
import { PosApi } from '../../../core/api/pos-api';
import { toApiError } from '../../../core/api/api-error';
import { Perm } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { DeviceConfigStore } from '../../../core/device/device-config.store';
import { CopPipe } from '../../../shared/cop.pipe';
import { ModalComponent } from '../../../shared/modal.component';
import { OwnerAuthComponent } from '../../../shared/owner-auth.component';

interface ReturnRow { id: string; description: string; available: number; lineTotal: number; quantity: number; unitQty: number; restock: boolean }

/**
 * HU-9.2: devolución total o parcial. El dinero sale en efectivo de esta caja (D-11) aunque la venta se haya pagado con
 * datáfono; por línea se decide si el producto vuelve al inventario. La autoriza un superior con su PIN.
 */
@Component({
  selector: 'app-return-sale-dialog',
  imports: [FormsModule, CopPipe, ModalComponent, OwnerAuthComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .rows td input[type=number] { width: 80px; }
  `,
  template: `
    <app-modal [title]="'Devolución · venta N° ' + sale().number" eyebrow="Devolución" (closed)="closed.emit()">
      <table class="rows">
        <thead><tr><th>Producto</th><th class="num">Disponible</th><th class="num">Devolver</th><th>Reingresa</th></tr></thead>
        <tbody>
          @for (r of rows(); track r.id) {
            <tr>
              <td>{{ r.description }}</td>
              <td class="num">{{ r.available }}</td>
              <td class="num"><input type="number" min="0" [max]="r.available" step="0.01" [(ngModel)]="r.quantity" (ngModelChange)="touch()"
                [attr.aria-label]="'Cantidad a devolver de ' + r.description" /></td>
              <td><input type="checkbox" [(ngModel)]="r.restock" (ngModelChange)="touch()" [attr.aria-label]="r.description + ' vuelve al inventario'" /></td>
            </tr>
          } @empty { <tr><td colspan="4" class="empty">Ya se devolvió todo.</td></tr> }
        </tbody>
      </table>
      <p class="small">Se devuelven aprox. <b>{{ estimate() | cop }}</b> en efectivo. Desmarca "Reingresa" si el producto está dañado o vencido.</p>
      <div class="field"><label for="rReason">Motivo</label><input id="rReason" maxlength="300" [(ngModel)]="reason" (ngModelChange)="touch()" /></div>
      <p class="err small" role="alert" style="min-height:18px">{{ error() }}</p>
      @if (needsAuthorizer()) {
        <p class="small muted">Las devoluciones las autoriza un superior.</p>
        <app-owner-auth [permission]="perm" (authorized)="submit($event)" />
        <div class="actions"><button type="button" (click)="closed.emit()">Cancelar</button></div>
      } @else {
        <div class="actions">
          <button type="button" (click)="closed.emit()">Cancelar</button>
          <button type="button" class="primary" (click)="submit()" [disabled]="busy()">Registrar devolución</button>
        </div>
      }
    </app-modal>
  `,
})
export class ReturnSaleDialog {
  private readonly api = inject(PosApi);
  private readonly session = inject(SessionStore);
  private readonly device = inject(DeviceConfigStore);

  readonly sale = input.required<SaleDto>();
  readonly closed = output<void>();
  readonly returned = output<SaleDto>();

  protected readonly perm = Perm.devolucionesAprobar;
  protected readonly needsAuthorizer = computed(() => !this.session.can(Perm.devolucionesAprobar));
  protected readonly rows = signal<ReturnRow[]>([]);
  private readonly version = signal(0);
  protected reason = '';
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  /** Una clave por intento: si cambian los datos, es otra devolución. */
  private key = newIdempotencyKey();

  protected readonly estimate = computed(() => {
    this.version();
    return this.rows().reduce((sum, r) => sum + (r.quantity > 0 ? (r.lineTotal * Math.min(r.quantity, r.available)) / r.unitQty : 0), 0);
  });

  constructor() {
    effect(() => {
      const s = this.sale();
      this.rows.set(s.lines
        .map((l) => ({ id: l.id, description: l.description, available: +(l.quantity - (s.returnedQuantities[l.id] ?? 0)).toFixed(2),
          lineTotal: l.lineTotal, unitQty: l.quantity, quantity: 0, restock: true }))
        .filter((r) => r.available > 0));
    });
  }

  protected touch(): void {
    this.version.update((v) => v + 1);
    this.key = newIdempotencyKey();
  }

  protected async submit(authorizerToken?: string): Promise<void> {
    const lines = this.rows().filter((r) => r.quantity > 0);
    if (lines.length === 0) return this.error.set('Indica cuánto se devuelve.');
    if (lines.some((r) => r.quantity > r.available)) return this.error.set('No se puede devolver más de lo disponible.');
    if (!this.reason.trim()) return this.error.set('La devolución exige motivo.');
    const cashRegisterId = this.device.config()?.cashRegisterId;
    if (!cashRegisterId) return this.error.set('Este equipo no está vinculado a una caja.');
    this.error.set('');
    this.busy.set(true);
    try {
      this.returned.emit(await this.api.returnSale(this.sale().id, {
        cashRegisterId, reason: this.reason.trim(),
        lines: lines.map((r) => ({ saleLineId: r.id, quantity: r.quantity, restock: r.restock })),
      }, this.key, authorizerToken));
    } catch (e) {
      this.error.set(toApiError(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
