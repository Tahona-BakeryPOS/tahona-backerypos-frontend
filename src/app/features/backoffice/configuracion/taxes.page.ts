import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { newIdempotencyKey } from '../../../core/api/api-client';
import { TaxDto, TaxKind } from '../../../core/api/api.models';
import { BackofficeApi } from '../../../core/api/backoffice-api';
import { AsyncAction } from '../../../shared/async-action';
import { ModalComponent } from '../../../shared/modal.component';
import { ToastService } from '../../../shared/toast.service';
import { BO_PAGE_STYLES } from '../backoffice.styles';

const KINDS: { value: TaxKind; label: string }[] = [
  { value: 'iva', label: 'IVA (DIAN 01)' },
  { value: 'inc', label: 'Impuesto al consumo (DIAN 04)' },
  { value: 'none', label: 'Sin impuesto / excluido (DIAN ZZ)' },
];

/**
 * Configuración → Taxes. The rate is not edited: for another rate another tax is created and the
 * previous one is deactivated. Sales store a copy of the rate applied.
 */
@Component({
  selector: 'app-taxes-page',
  imports: [ReactiveFormsModule, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: BO_PAGE_STYLES,
  template: `
    <div class="head"><div><h1>Impuestos</h1><p>Los precios de lista incluyen el impuesto. La tarifa no se cambia: crea uno nuevo y desactiva el anterior. Confirma las tarifas con tu contador.</p></div></div>
    <div class="grid-2">
      <div class="card scroll-x">
        <table>
          <thead><tr><th>Impuesto</th><th>Tipo</th><th class="num">Tarifa</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            @for (t of taxes.value() ?? []; track t.id) {
              <tr><td>{{ t.name }} <div class="small muted"><code>{{ t.code }}</code></div></td><td>{{ kindLabel(t.kind) }}</td><td class="num">{{ t.rate }}%</td>
                <td><span class="badge" [class.ok]="t.isActive">{{ t.isActive ? 'activo' : 'inactivo' }}</span></td>
                <td><button type="button" class="sm" (click)="edit(t)">Editar</button></td></tr>
            } @empty { <tr><td colspan="5" class="state">{{ taxes.isLoading() ? 'Cargando…' : 'Sin impuestos.' }}</td></tr> }
          </tbody>
        </table>
      </div>
      <form class="card pad" [formGroup]="form" (ngSubmit)="create()">
        <h2>Nuevo impuesto</h2>
        <div class="two">
          <div class="field"><label for="tCode">Código</label><input id="tCode" formControlName="code" placeholder="IVA19" maxlength="20" /></div>
          <div class="field"><label for="tRate">Tarifa (%)</label><input id="tRate" type="number" min="0" max="100" step="0.01" formControlName="rate" /></div>
        </div>
        <div class="field"><label for="tName">Nombre</label><input id="tName" formControlName="name" placeholder="IVA 19 %" /></div>
        <div class="field"><label for="tKind">Tipo</label>
          <select id="tKind" formControlName="kind">@for (k of kinds; track k.value) { <option [value]="k.value">{{ k.label }}</option> }</select></div>
        <p class="err small" role="alert">{{ createAction.error() }}</p>
        <button class="primary" type="submit" [disabled]="form.invalid || createAction.busy()">Crear impuesto</button>
      </form>
    </div>

    @if (editing(); as t) {
      <app-modal [title]="t.name" [eyebrow]="t.code + ' · ' + t.rate + '%'" (closed)="editing.set(null)">
        <form [formGroup]="editForm" (ngSubmit)="save(t)">
          <div class="field"><label for="eName">Nombre</label><input id="eName" formControlName="name" /></div>
          <label class="row small"><input type="checkbox" formControlName="isActive" style="width:auto;min-height:auto" /> Activo (si no, no se ofrece a productos nuevos)</label>
          <p class="err small" role="alert">{{ editAction.error() }}</p>
          <div class="actions"><button type="button" (click)="editing.set(null)">Cancelar</button>
            <button type="submit" class="primary" [disabled]="editForm.invalid || editForm.pristine || editAction.busy()">Guardar</button></div>
        </form>
      </app-modal>
    }
  `,
})
export class TaxesPage {
  private readonly bo = inject(BackofficeApi);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly toast = inject(ToastService);
  protected readonly kinds = KINDS;
  protected readonly createAction = new AsyncAction(this.toast);
  protected readonly editAction = new AsyncAction(this.toast);
  protected readonly taxes = resource({ loader: () => this.bo.taxes() });
  protected readonly editing = signal<TaxDto | null>(null);
  protected readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(20), Validators.pattern(/^[A-Za-z0-9_-]+$/)]],
    name: ['', [Validators.required, Validators.maxLength(80)]],
    kind: ['iva' as TaxKind, Validators.required],
    rate: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
  });
  protected readonly editForm = this.fb.group({ name: ['', [Validators.required, Validators.maxLength(80)]], isActive: [true] });

  private key = newIdempotencyKey();

  protected kindLabel(k: string): string {
    return KINDS.find((x) => x.value === k)?.label.split(' (')[0] ?? k;
  }

  protected async create(): Promise<void> {
    const v = this.form.getRawValue();
    const created = await this.createAction.run(
      () => this.bo.createTax({ code: v.code.trim().toUpperCase(), name: v.name.trim(), kind: v.kind, rate: Number(v.rate) }, this.key),
      'Impuesto creado');
    if (created) { this.key = newIdempotencyKey(); this.form.reset(); this.taxes.reload(); }
  }

  protected edit(t: TaxDto): void {
    this.editAction.error.set('');
    this.editForm.reset({ name: t.name, isActive: t.isActive });
    this.editing.set(t);
  }

  protected async save(t: TaxDto): Promise<void> {
    const v = this.editForm.getRawValue();
    const saved = await this.editAction.run(() => this.bo.updateTax(t, { name: v.name.trim(), isActive: v.isActive }), 'Impuesto guardado');
    if (saved) { this.editing.set(null); this.taxes.reload(); }
  }
}
