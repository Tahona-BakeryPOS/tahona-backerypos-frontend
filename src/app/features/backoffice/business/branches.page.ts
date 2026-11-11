import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { newIdempotencyKey } from '../../../core/api/api-client';
import { BranchDto } from '../../../core/api/api.models';
import { BackofficeApi } from '../../../core/api/backoffice-api';
import { AsyncAction } from '../../../shared/async-action';
import { ModalComponent } from '../../../shared/modal.component';
import { ToastService } from '../../../shared/toast.service';
import { BO_PAGE_STYLES } from '../backoffice.styles';

const CODE = /^[A-Za-z0-9_-]{1,20}$/;

/**
 * Mi negocio → Branches and registers (US-1.3): sites with their registers; create, edit (If-Match) and
 * deactivate sites; create registers. Creations carry Idempotency-Key: if the network drops and
 * the same form is retried, the API does not create a duplicate.
 */
@Component({
  selector: 'app-branches-page',
  imports: [ReactiveFormsModule, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: BO_PAGE_STYLES,
  template: `
    <div class="head"><div><h1>Sucursales y cajas</h1><p>Cada sucursal tiene sus cajas y sus usuarios asignados. Desactivar no borra nada.</p></div></div>
    <div class="card scroll-x" style="margin-bottom:16px">
      <table>
        <thead><tr><th>Sucursal</th><th>Dirección</th><th>Cajas</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          @for (b of rows(); track b.id) {
            <tr>
              <td><b>{{ b.name }}</b> <span class="small muted">· {{ b.code }}</span>@if (b.phone) { <div class="small muted">{{ b.phone }}</div> }</td>
              <td>{{ b.address || '—' }}</td>
              <td>@for (r of b.registers; track r.id) { <div class="small">{{ r.name }} <span class="muted">· {{ r.code }}</span>@if (!r.isActive) { <span class="badge">inactiva</span> }</div> } @empty { <span class="small muted">Sin cajas</span> }</td>
              <td><span class="badge" [class.ok]="b.isActive">{{ b.isActive ? 'activa' : 'inactiva' }}</span></td>
              <td>@if (b.isActive) { <button type="button" class="sm" (click)="edit(b)">Editar</button> }</td>
            </tr>
          } @empty { <tr><td colspan="5" class="state">{{ branches.isLoading() ? 'Cargando…' : loadError() || 'Aún no hay sucursales.' }}</td></tr> }
        </tbody>
      </table>
    </div>
    <div class="grid-2">
      <form class="card pad" [formGroup]="branch" (ngSubmit)="createBranch()">
        <h2>Nueva sucursal</h2>
        <div class="two">
          <div class="field"><label for="bCode">Código</label><input id="bCode" formControlName="code" placeholder="NORTE" maxlength="20" /></div>
          <div class="field"><label for="bName">Nombre</label><input id="bName" formControlName="name" placeholder="Sede Norte" /></div>
        </div>
        <div class="field"><label for="bAddr">Dirección</label><input id="bAddr" formControlName="address" /></div>
        <div class="two">
          <div class="field"><label for="bPhone">Teléfono</label><input id="bPhone" formControlName="phone" inputmode="tel" /></div>
          <div class="field"><label for="bCity">Código de ciudad (DANE)</label><input id="bCity" formControlName="cityCode" inputmode="numeric" maxlength="5" /></div>
        </div>
        <p class="small muted">Código: letras, números, guion o guion bajo. No se puede cambiar después.</p>
        <p class="err small" role="alert">{{ branchAction.error() }}</p>
        <button class="primary" type="submit" [disabled]="branch.invalid || branchAction.busy()">Crear sucursal</button>
      </form>
      <form class="card pad" [formGroup]="register" (ngSubmit)="createRegister()">
        <h2>Nueva caja</h2>
        <div class="field"><label for="rBranch">Sucursal</label>
          <select id="rBranch" formControlName="branchId">
            <option value="">— elegir —</option>
            @for (b of activeBranches(); track b.id) { <option [value]="b.id">{{ b.name }}</option> }
          </select>
        </div>
        <div class="two">
          <div class="field"><label for="rCode">Código</label><input id="rCode" formControlName="code" placeholder="CAJA2" maxlength="20" /></div>
          <div class="field"><label for="rName">Nombre</label><input id="rName" formControlName="name" placeholder="Caja 2" /></div>
        </div>
        <p class="err small" role="alert">{{ registerAction.error() }}</p>
        <button class="primary" type="submit" [disabled]="register.invalid || registerAction.busy()">Crear caja</button>
        <p class="small muted">Después vincula un equipo a la caja en Puntos de venta.</p>
      </form>
    </div>

    @if (editing(); as b) {
      <app-modal [title]="b.name" [eyebrow]="'Sucursal · ' + b.code" (closed)="editing.set(null)">
        <form [formGroup]="editForm" (ngSubmit)="saveEdit(b)">
          <div class="field"><label for="eName">Nombre</label><input id="eName" formControlName="name" /></div>
          <div class="field"><label for="eAddr">Dirección</label><input id="eAddr" formControlName="address" /></div>
          <div class="two">
            <div class="field"><label for="ePhone">Teléfono</label><input id="ePhone" formControlName="phone" inputmode="tel" /></div>
            <div class="field"><label for="eCity">Código de ciudad (DANE)</label><input id="eCity" formControlName="cityCode" inputmode="numeric" maxlength="5" /></div>
          </div>
          <p class="err small" role="alert">{{ editAction.error() }}</p>
          <div class="actions">
            <button type="button" class="ghost" (click)="deactivate(b)" [disabled]="editAction.busy()">Desactivar sucursal</button>
            <button type="submit" class="primary" [disabled]="editForm.invalid || editAction.busy()">Guardar</button>
          </div>
        </form>
      </app-modal>
    }
  `,
})
export class BranchesPage {
  private readonly bo = inject(BackofficeApi);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly toast = inject(ToastService);

  protected readonly branches = resource({ loader: () => this.bo.branches() });
  protected readonly registers = resource({ loader: () => this.bo.cashRegisters() });
  protected readonly rows = computed(() => {
    const regs = this.registers.value() ?? [];
    return (this.branches.value() ?? []).map((b) => ({ ...b, registers: regs.filter((r) => r.branchId === b.id) }));
  });
  protected readonly activeBranches = computed(() => (this.branches.value() ?? []).filter((b) => b.isActive));
  protected readonly editing = signal<BranchDto | null>(null);

  protected readonly branchAction = new AsyncAction(this.toast);
  protected readonly registerAction = new AsyncAction(this.toast);
  protected readonly editAction = new AsyncAction(this.toast);
  protected readonly branch = this.fb.group({
    code: ['', [Validators.required, Validators.pattern(CODE)]],
    name: ['', [Validators.required, Validators.maxLength(120)]],
    address: [''], phone: [''], cityCode: ['', Validators.pattern(/^\d{5}$/)],
  });
  protected readonly register = this.fb.group({
    branchId: ['', Validators.required],
    code: ['', [Validators.required, Validators.pattern(CODE)]],
    name: ['', Validators.required],
  });
  protected readonly editForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    address: [''], phone: [''], cityCode: ['', Validators.pattern(/^\d{5}$/)],
  });

  /** One key per attempt: it is reused if the attempt fails and renewed on create. */
  private branchKey = newIdempotencyKey();
  private registerKey = newIdempotencyKey();

  protected loadError(): string {
    return (this.branches.error() as Error | undefined)?.message ?? '';
  }

  protected async createBranch(): Promise<void> {
    const v = this.branch.getRawValue();
    const created = await this.branchAction.run(() => this.bo.createBranch({
      code: v.code.trim().toUpperCase(), name: v.name.trim(), address: v.address.trim() || null,
      cityCode: v.cityCode.trim() || null, phone: v.phone.trim() || null,
    }, this.branchKey), 'Sucursal creada');
    if (created) { this.branchKey = newIdempotencyKey(); this.branch.reset(); this.branches.reload(); }
  }

  protected async createRegister(): Promise<void> {
    const v = this.register.getRawValue();
    const created = await this.registerAction.run(
      () => this.bo.createCashRegister({ branchId: v.branchId, code: v.code.trim().toUpperCase(), name: v.name.trim() }, this.registerKey),
      'Caja creada');
    if (created) { this.registerKey = newIdempotencyKey(); this.register.reset({ branchId: v.branchId, code: '', name: '' }); this.registers.reload(); }
  }

  protected edit(b: BranchDto): void {
    this.editAction.error.set('');
    this.editForm.reset({ name: b.name, address: b.address ?? '', phone: b.phone ?? '', cityCode: b.cityCode ?? '' });
    this.editing.set(b);
  }

  protected async saveEdit(b: BranchDto): Promise<void> {
    const v = this.editForm.getRawValue();
    const saved = await this.editAction.run(() => this.bo.updateBranch(b.id, {
      name: v.name.trim(), address: v.address.trim() || null, cityCode: v.cityCode.trim() || null, phone: v.phone.trim() || null,
    }, b.version), 'Sucursal guardada');
    if (saved) { this.editing.set(null); this.branches.reload(); }
  }

  protected async deactivate(b: BranchDto): Promise<void> {
    if (!confirm(`¿Desactivar ${b.name}? Queda en la lista como inactiva; no se borra nada.`)) return;
    const done = await this.editAction.run(() => this.bo.deactivateBranch(b.id), `${b.name} desactivada`);
    if (done) { this.editing.set(null); this.branches.reload(); }
  }
}
