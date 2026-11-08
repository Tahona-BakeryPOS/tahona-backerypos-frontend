import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { newIdempotencyKey } from '../../../core/api/api-client';
import { CategoryDto } from '../../../core/api/api.models';
import { BackofficeApi } from '../../../core/api/backoffice-api';
import { AsyncAction } from '../../../shared/async-action';
import { ModalComponent } from '../../../shared/modal.component';
import { ToastService } from '../../../shared/toast.service';
import { BO_PAGE_STYLES } from '../backoffice.styles';

/** Productos → Categorías: las pestañas que ve el cajero en la pantalla de venta, en este orden. */
@Component({
  selector: 'app-categories-page',
  imports: [ReactiveFormsModule, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: BO_PAGE_STYLES,
  template: `
    <div class="head"><div><h1>Categorías</h1><p>Son las pestañas de la pantalla de venta. El orden define cuál aparece primero.</p></div></div>
    <div class="grid-2">
      <div class="card scroll-x">
        <table>
          <thead><tr><th class="num">Orden</th><th>Categoría</th><th class="num">Productos</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            @for (c of categories.value() ?? []; track c.id) {
              <tr><td class="num">{{ c.displayOrder }}</td><td><b>{{ c.name }}</b></td>
                <td class="num">{{ c.productCount }}</td><td><span class="badge" [class.ok]="c.isActive">{{ c.isActive ? 'activa' : 'inactiva' }}</span></td>
                <td><button type="button" class="sm" (click)="edit(c)">Editar</button></td></tr>
            } @empty { <tr><td colspan="5" class="state">{{ categories.isLoading() ? 'Cargando…' : 'Sin categorías.' }}</td></tr> }
          </tbody>
        </table>
      </div>
      <form class="card pad" [formGroup]="form" (ngSubmit)="create()">
        <h2>Nueva categoría</h2>
        <div class="field"><label for="cName">Nombre</label><input id="cName" formControlName="name" placeholder="Panes" /></div>
        <div class="field"><label for="cOrder">Orden</label><input id="cOrder" type="number" min="0" formControlName="displayOrder" /></div>
        <p class="err small" role="alert">{{ createAction.error() }}</p>
        <button class="primary" type="submit" [disabled]="form.invalid || createAction.busy()">Crear categoría</button>
      </form>
    </div>

    @if (editing(); as c) {
      <app-modal [title]="c.name" eyebrow="Categoría" (closed)="editing.set(null)">
        <form [formGroup]="editForm" (ngSubmit)="save(c)">
          <div class="field"><label for="eName">Nombre</label><input id="eName" formControlName="name" /></div>
          <div class="field"><label for="eOrder">Orden</label><input id="eOrder" type="number" min="0" formControlName="displayOrder" /></div>
          <label class="row small"><input type="checkbox" formControlName="isActive" style="width:auto;min-height:auto" /> Activa (si no, no se ofrece al crear productos)</label>
          <p class="err small" role="alert">{{ editAction.error() }}</p>
          <div class="actions"><button type="button" (click)="editing.set(null)">Cancelar</button>
            <button type="submit" class="primary" [disabled]="editForm.invalid || editForm.pristine || editAction.busy()">Guardar</button></div>
        </form>
      </app-modal>
    }
  `,
})
export class CategoriesPage {
  private readonly bo = inject(BackofficeApi);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly toast = inject(ToastService);
  protected readonly createAction = new AsyncAction(this.toast);
  protected readonly editAction = new AsyncAction(this.toast);
  protected readonly categories = resource({ loader: () => this.bo.categories() });
  protected readonly editing = signal<CategoryDto | null>(null);
  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    displayOrder: [0, Validators.min(0)],
  });
  protected readonly editForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    displayOrder: [0, Validators.min(0)],
    isActive: [true],
  });

  private key = newIdempotencyKey();

  protected async create(): Promise<void> {
    const v = this.form.getRawValue();
    const created = await this.createAction.run(() => this.bo.createCategory(v.name.trim(), Number(v.displayOrder), this.key), 'Categoría creada');
    if (created) { this.key = newIdempotencyKey(); this.form.reset(); this.categories.reload(); }
  }

  protected edit(c: CategoryDto): void {
    this.editAction.error.set('');
    this.editForm.reset({ name: c.name, displayOrder: c.displayOrder, isActive: c.isActive });
    this.editing.set(c);
  }

  protected async save(c: CategoryDto): Promise<void> {
    const v = this.editForm.getRawValue();
    const saved = await this.editAction.run(() => this.bo.updateCategory(c, { name: v.name.trim(), displayOrder: Number(v.displayOrder), isActive: v.isActive }), 'Categoría guardada');
    if (saved) { this.editing.set(null); this.categories.reload(); }
  }
}
