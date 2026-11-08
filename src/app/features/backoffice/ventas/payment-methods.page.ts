import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { newIdempotencyKey } from '../../../core/api/api-client';
import { PaymentMethodDto, PaymentMethodKind } from '../../../core/api/api.models';
import { BackofficeApi } from '../../../core/api/backoffice-api';
import { AsyncAction } from '../../../shared/async-action';
import { ModalComponent } from '../../../shared/modal.component';
import { ToastService } from '../../../shared/toast.service';
import { BO_PAGE_STYLES } from '../backoffice.styles';

const KIND: Record<PaymentMethodKind, string> = {
  cash: 'Efectivo', gateway: 'Bold (datáfono)', external_card: 'Datáfono externo', transfer_manual: 'Transferencia',
};
const GATEWAY: Record<string, string> = { POS: 'Tarjeta', NEQUI: 'Nequi', PAY_BY_QR_BOLD: 'QR Bold' };

/**
 * Ventas y caja → Métodos de pago: los que ofrece la caja al cobrar. Los de Bold se cobran en el datáfono
 * y solo se activan con la integración configurada; datáfono externo y transferencia exigen referencia.
 */
@Component({
  selector: 'app-payment-methods-page',
  imports: [ReactiveFormsModule, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: BO_PAGE_STYLES,
  template: `
    <div class="head">
      <div><h1>Métodos de pago</h1><p>EFECTIVO es el único que admite cambio y no se puede desactivar. Los de Bold necesitan la integración activa (Configuración → Integraciones).</p></div>
      <button type="button" class="primary" (click)="openCreate()">＋ Nuevo método</button>
    </div>
    <div class="card scroll-x" style="max-width:900px">
      <table>
        <thead><tr><th class="num">Orden</th><th>Código</th><th>Nombre</th><th>Tipo</th><th>Referencia</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          @for (m of methods.value() ?? []; track m.id) {
            <tr>
              <td class="num">{{ m.displayOrder }}</td>
              <td><code>{{ m.code }}</code></td><td>{{ m.name }}</td>
              <td>{{ kind(m) }}</td>
              <td>{{ m.requiresReference ? 'Obligatoria' : '—' }}</td>
              <td><span class="badge" [class.ok]="m.isActive">{{ m.isActive ? 'activo' : 'inactivo' }}</span></td>
              <td><button type="button" class="sm" (click)="openEdit(m)">Editar</button></td>
            </tr>
          } @empty { <tr><td colspan="7" class="state">{{ methods.isLoading() ? 'Cargando…' : 'Sin métodos de pago.' }}</td></tr> }
        </tbody>
      </table>
    </div>

    @if (editing(); as e) {
      <app-modal [title]="e.method ? 'Editar método de pago' : 'Nuevo método de pago'" [eyebrow]="e.method?.code ?? 'Métodos de pago'" (closed)="editing.set(null)">
        <form [formGroup]="form" (ngSubmit)="save()">
          @if (!e.method) {
            <div class="two">
              <div class="field"><label for="mCode">Código</label><input id="mCode" formControlName="code" placeholder="DATAFONO_REDEBAN" maxlength="30" /></div>
              <div class="field"><label for="mKind">Tipo</label>
                <select id="mKind" formControlName="kind">
                  <option value="external_card">Datáfono externo (no integrado)</option>
                  <option value="transfer_manual">Transferencia</option>
                  <option value="gateway">Bold (datáfono)</option>
                </select></div>
            </div>
            @if (form.controls.kind.value === 'gateway') {
              <div class="field"><label for="mGw">Método en Bold</label>
                <select id="mGw" formControlName="gatewayMethod"><option value="POS">Tarjeta</option><option value="NEQUI">Nequi</option><option value="PAY_BY_QR_BOLD">QR Bold</option></select></div>
            }
          }
          <div class="two">
            <div class="field"><label for="mName">Nombre</label><input id="mName" formControlName="name" /></div>
            <div class="field"><label for="mOrder">Orden en la caja</label><input id="mOrder" type="number" min="0" formControlName="displayOrder" /></div>
          </div>
          <label class="row small"><input type="checkbox" formControlName="requiresReference" style="width:auto;min-height:auto" /> Exige referencia (siempre en datáfono externo y transferencia)</label>
          @if (e.method) { <label class="row small"><input type="checkbox" formControlName="isActive" style="width:auto;min-height:auto" /> Activo</label> }
          <p class="err small" role="alert">{{ action.error() }}</p>
          <div class="actions"><button type="button" (click)="editing.set(null)">Cancelar</button>
            <button type="submit" class="primary" [disabled]="form.invalid || action.busy()">Guardar</button></div>
        </form>
      </app-modal>
    }
  `,
})
export class PaymentMethodsPage {
  private readonly bo = inject(BackofficeApi);
  protected readonly action = new AsyncAction(inject(ToastService));
  protected readonly methods = resource({ loader: () => this.bo.paymentMethods() });
  protected readonly editing = signal<{ method: PaymentMethodDto | null } | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(30), Validators.pattern(/^[A-Za-z0-9_-]+$/)]],
    kind: ['external_card' as PaymentMethodKind],
    gatewayMethod: ['POS'],
    name: ['', [Validators.required, Validators.maxLength(80)]],
    displayOrder: [0, Validators.min(0)],
    requiresReference: [true],
    isActive: [true],
  });
  private key = newIdempotencyKey();

  protected kind(m: PaymentMethodDto): string {
    return m.kind === 'gateway' ? `${KIND.gateway} · ${GATEWAY[m.gatewayMethod ?? ''] ?? m.gatewayMethod}` : KIND[m.kind];
  }

  protected openCreate(): void {
    this.action.error.set('');
    this.form.reset({ kind: 'external_card', gatewayMethod: 'POS', displayOrder: (this.methods.value()?.length ?? 0), requiresReference: true, isActive: true });
    this.form.controls.code.enable();
    this.key = newIdempotencyKey();
    this.editing.set({ method: null });
  }

  protected openEdit(m: PaymentMethodDto): void {
    this.action.error.set('');
    this.form.reset({ code: m.code, kind: m.kind, gatewayMethod: m.gatewayMethod ?? 'POS', name: m.name, displayOrder: m.displayOrder,
      requiresReference: m.requiresReference, isActive: m.isActive });
    this.form.controls.code.disable();
    this.editing.set({ method: m });
  }

  protected async save(): Promise<void> {
    const current = this.editing()?.method ?? null;
    const v = this.form.getRawValue();
    const saved = current
      ? await this.action.run(() => this.bo.updatePaymentMethod(current, { name: v.name.trim(), requiresReference: v.requiresReference,
          displayOrder: Number(v.displayOrder), isActive: v.isActive }), 'Método de pago guardado')
      : await this.action.run(() => this.bo.createPaymentMethod({ code: v.code.trim().toUpperCase(), name: v.name.trim(), kind: v.kind,
          gatewayMethod: v.kind === 'gateway' ? v.gatewayMethod : null, requiresReference: v.requiresReference,
          displayOrder: Number(v.displayOrder) }, this.key), 'Método de pago creado');
    if (saved) { this.editing.set(null); this.methods.reload(); }
  }
}
