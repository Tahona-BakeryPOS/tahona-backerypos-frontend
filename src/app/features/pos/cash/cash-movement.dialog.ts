import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { newIdempotencyKey } from '../../../core/api/api-client';
import { toApiError } from '../../../core/api/api-error';
import { Perm } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { CashStore } from '../../../core/shift/cash.store';
import { CopPipe } from '../../../shared/cop.pipe';
import { ModalComponent } from '../../../shared/modal.component';
import { OwnerAuthComponent } from '../../../shared/owner-auth.component';
import { ToastService } from '../../../shared/toast.service';

/**
 * US-5.3: cash income or withdrawal with a reason. A withdrawal is authorized by a supervisor (cash.withdrawal): if
 * whoever is serving does not hold it, the supervisor chooses their name and enters their PIN.
 */
@Component({
  selector: 'app-cash-movement-dialog',
  imports: [FormsModule, CopPipe, ModalComponent, OwnerAuthComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [title]="isExpense() ? 'Retiro de efectivo' : 'Ingreso de efectivo'" eyebrow="Caja" (closed)="closed.emit()">
      <div class="field">
        <label for="mAmt">Monto (mayor a 0)</label>
        <input id="mAmt" type="number" inputmode="numeric" min="0" [ngModel]="amount" (ngModelChange)="amount = $event; renewKey()" />
      </div>
      <div class="field">
        <label for="mReason">Motivo</label>
        <select id="mReason" [ngModel]="reasonId" (ngModelChange)="reasonId = $event; renewKey()">
          <option value="">— elegir —</option>
          @for (r of reasons(); track r.id) { <option [value]="r.id">{{ r.name }}</option> }
        </select>
      </div>
      <div class="field"><label for="mNote">Nota (opcional)</label><input id="mNote" maxlength="200" [ngModel]="note" (ngModelChange)="note = $event; renewKey()" /></div>
      @if (isExpense()) { <p class="small muted">No puede superar el efectivo esperado: {{ cash.expected() | cop }}</p> }
      <p class="err small" role="alert" style="min-height:18px">{{ error() }}</p>
      @if (needsAuthorizer()) {
        <p class="small muted">Los retiros los autoriza un superior.</p>
        <app-owner-auth [permission]="perm" (authorized)="submit($event)" />
        <div class="actions"><button type="button" (click)="closed.emit()">Cancelar</button></div>
      } @else {
        <div class="actions">
          <button type="button" (click)="closed.emit()">Cancelar</button>
          <button type="button" class="primary" (click)="submit()" [disabled]="busy()">Registrar</button>
        </div>
      }
    </app-modal>
  `,
})
export class CashMovementDialog {
  protected readonly cash = inject(CashStore);
  private readonly session = inject(SessionStore);
  private readonly toast = inject(ToastService);

  readonly kind = input.required<'income' | 'expense'>();
  readonly closed = output<void>();

  protected readonly perm = Perm.cashWithdrawal;
  protected readonly isExpense = computed(() => this.kind() === 'expense');
  protected readonly needsAuthorizer = computed(() => this.isExpense() && !this.session.can(Perm.cashWithdrawal));
  protected readonly reasons = computed(() => this.cash.reasons().filter((r) => r.kind === this.kind()));
  protected amount: number | null = null;
  protected reasonId = '';
  protected note = '';
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  /** Retrying after a network drop reuses the key; changing the data starts a new attempt. */
  private key = newIdempotencyKey();

  protected renewKey(): void {
    this.key = newIdempotencyKey();
  }

  protected async submit(authorizerToken?: string): Promise<void> {
    if (!this.reasonId) return this.error.set('Elige un motivo.');
    this.busy.set(true);
    this.error.set('');
    try {
      await this.cash.register(this.kind(), Number(this.amount), this.reasonId, this.note.trim() || null, this.key, authorizerToken);
      this.toast.show('Movimiento registrado');
      this.closed.emit();
    } catch (e) {
      const err = toApiError(e);
      this.error.set(err.isNetwork ? 'Registrar movimientos requiere conexión. Intenta de nuevo.' : err.message);
    } finally {
      this.busy.set(false);
    }
  }
}
