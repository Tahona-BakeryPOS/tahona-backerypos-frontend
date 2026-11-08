import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { newIdempotencyKey } from '../../../core/api/api-client';
import { AssignmentDto, UserDto } from '../../../core/api/api.models';
import { BackofficeApi } from '../../../core/api/backoffice-api';
import { SessionStore } from '../../../core/auth/session.store';
import { AsyncAction } from '../../../shared/async-action';
import { ModalComponent } from '../../../shared/modal.component';
import { ToastService } from '../../../shared/toast.service';
import { BO_PAGE_STYLES } from '../backoffice.styles';

const PIN = /^\d{4,6}$/;
/** Valor del selector para "todas las sucursales" (la API recibe branchId null). */
const ALL = '*';

const emailOrPin = (g: AbstractControl): ValidationErrors | null =>
  g.get('email')!.value.trim() || g.get('pin')!.value ? null : { emailOrPin: true };

/**
 * Configuración → Usuarios (HU-2.1). Un usuario entra a la caja con PIN, al backoffice con correo, o
 * ambos; sus roles se asignan por sucursal (o para todas). Con correo nuevo, la API devuelve una
 * contraseña de un solo uso que se muestra una sola vez. Editar envía la versión leída (If-Match).
 */
@Component({
  selector: 'app-users-page',
  imports: [ReactiveFormsModule, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [BO_PAGE_STYLES, `
    .assignment { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 8px; background: var(--surface2); font-size: 14px; margin-bottom: 6px; }
    .secret { font: 700 22px/1.2 var(--mono); text-align: center; padding: 14px; border: 2px dashed var(--brand); border-radius: 12px; margin: 10px 0; user-select: all; overflow-wrap: anywhere; }
    hr { border: 0; border-top: 1px solid var(--line); margin: 16px 0; }
  `],
  template: `
    <div class="head">
      <div><h1>Usuarios</h1><p>Cada persona entra a la caja con su PIN y solo en las sucursales donde tiene un rol vigente.</p></div>
      <button type="button" class="primary" (click)="openCreate()">＋ Nuevo usuario</button>
    </div>
    <div class="card scroll-x">
      <table>
        <thead><tr><th>Nombre</th><th>Roles vigentes</th><th>PIN</th><th>Backoffice</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          @for (u of users.value() ?? []; track u.id) {
            <tr>
              <td><b>{{ u.fullName }}</b>@if (u.email) { <div class="small muted">{{ u.email }}</div> }</td>
              <td>@for (a of current(u); track a.id) { <div class="small">{{ a.roleName }} · {{ branchName(a.branchId) }}</div> } @empty { <span class="small warn">Sin rol vigente: no puede entrar</span> }</td>
              <td>{{ u.hasPin ? 'Sí' : '—' }}</td>
              <td>{{ u.canUseBackoffice ? 'Sí' : '—' }}</td>
              <td><span class="badge" [class.ok]="u.isActive">{{ u.isActive ? 'activo' : 'inactivo' }}</span></td>
              <td><button type="button" class="sm" (click)="manage(u)">Gestionar</button></td>
            </tr>
          } @empty { <tr><td colspan="6" class="state">{{ users.isLoading() ? 'Cargando…' : 'Sin usuarios.' }}</td></tr> }
        </tbody>
      </table>
    </div>

    @if (creating()) {
      <app-modal title="Nuevo usuario" eyebrow="Usuarios" (closed)="creating.set(false)">
        <form [formGroup]="createForm" (ngSubmit)="create()">
          <div class="field"><label for="uName">Nombre completo</label><input id="uName" formControlName="fullName" /></div>
          <div class="two">
            <div class="field"><label for="uRole">Rol</label><select id="uRole" formControlName="roleId"><option value="">— elegir —</option>
              @for (r of roles.value() ?? []; track r.id) { <option [value]="r.id">{{ r.name }}</option> }</select></div>
            <div class="field"><label for="uBranch">Sucursal</label><select id="uBranch" formControlName="branchId">
              <option [value]="all">Todas las sucursales</option>
              @for (b of activeBranches(); track b.id) { <option [value]="b.id">{{ b.name }}</option> }</select></div>
          </div>
          <div class="field"><label for="uPin">PIN de caja (4 a 6 dígitos)</label><input id="uPin" type="password" inputmode="numeric" maxlength="6" formControlName="pin" autocomplete="new-password" /></div>
          <div class="field"><label for="uEmail">Correo para el backoffice (opcional)</label><input id="uEmail" type="email" formControlName="email" autocomplete="off" /></div>
          <p class="small muted">Indica PIN, correo o ambos. El PIN entrégalo en persona. Si el correo ya tiene cuenta en otra empresa, conserva su contraseña.</p>
          <p class="err small" role="alert">{{ action.error() }}</p>
          <div class="actions"><button type="button" (click)="creating.set(false)">Cancelar</button>
            <button type="submit" class="primary" [disabled]="createForm.invalid || action.busy()">Crear usuario</button></div>
        </form>
      </app-modal>
    }

    @if (temporary(); as t) {
      <app-modal title="Contraseña de un solo uso" [eyebrow]="t.email" (closed)="temporary.set(null)">
        <p>Entrégale esta contraseña a <b>{{ t.name }}</b>. Al entrar al backoffice deberá cambiarla.</p>
        <div class="secret">{{ t.password }}</div>
        <p class="small warn">No se vuelve a mostrar: cópiala ahora.</p>
        <div class="actions"><button type="button" (click)="copy(t.password)">Copiar</button>
          <button type="button" class="primary" (click)="temporary.set(null)">Listo</button></div>
      </app-modal>
    }

    @if (managed(); as u) {
      <app-modal [title]="u.fullName" eyebrow="Gestionar usuario" (closed)="managingId.set(null)">
        <h3 style="font-size:15px">Roles</h3>
        @for (a of current(u); track a.id) {
          <div class="assignment"><span>{{ a.roleName }} · {{ branchName(a.branchId) }}</span>
            <button type="button" class="ghost sm" (click)="endAssignment(u, a)" [disabled]="action.busy()">Quitar</button></div>
        } @empty { <p class="small muted">Sin roles vigentes.</p> }
        <form [formGroup]="roleForm" (ngSubmit)="assign(u)">
          <div class="two">
            <div class="field"><label for="aRole">Rol</label><select id="aRole" formControlName="roleId"><option value="">— elegir —</option>
              @for (r of roles.value() ?? []; track r.id) { <option [value]="r.id">{{ r.name }}</option> }</select></div>
            <div class="field"><label for="aBranch">Sucursal</label><select id="aBranch" formControlName="branchId">
              <option [value]="all">Todas las sucursales</option>
              @for (b of activeBranches(); track b.id) { <option [value]="b.id">{{ b.name }}</option> }</select></div>
          </div>
          <button type="submit" class="sm" [disabled]="roleForm.invalid || action.busy()">Agregar rol</button>
        </form>
        <hr />
        <form [formGroup]="editForm" (ngSubmit)="save(u)">
          <h3 style="font-size:15px">Datos</h3>
          <div class="field"><label for="eName">Nombre completo</label><input id="eName" formControlName="fullName" /></div>
          <div class="field"><label for="ePin">Nuevo PIN (vacío para no cambiarlo)</label>
            <input id="ePin" type="password" inputmode="numeric" maxlength="6" formControlName="pin" autocomplete="new-password" /></div>
          <label class="row small"><input type="checkbox" formControlName="isActive" style="width:auto;min-height:auto" /> Usuario activo en esta empresa</label>
          @if (u.id === me) { <p class="small muted">No puedes desactivarte a ti mismo.</p> }
          <p class="err small" role="alert">{{ action.error() }}</p>
          <div class="actions"><button type="button" (click)="managingId.set(null)">Cerrar</button>
            <button type="submit" class="primary" [disabled]="editForm.invalid || editForm.pristine || action.busy()">Guardar</button></div>
        </form>
      </app-modal>
    }
  `,
})
export class UsersPage {
  private readonly bo = inject(BackofficeApi);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly toast = inject(ToastService);
  protected readonly me = inject(SessionStore).user()?.id;
  protected readonly all = ALL;
  protected readonly action = new AsyncAction(this.toast);
  protected readonly users = resource({ loader: () => this.bo.users() });
  protected readonly roles = resource({ loader: () => this.bo.roles() });
  protected readonly branches = resource({ loader: () => this.bo.branches() });
  protected readonly activeBranches = computed(() => (this.branches.value() ?? []).filter((b) => b.isActive));
  protected readonly creating = signal(false);
  protected readonly temporary = signal<{ name: string; email: string; password: string } | null>(null);
  protected readonly managingId = signal<string | null>(null);
  /** Se toma de la lista recargada: así la versión (If-Match) y los roles siempre son los últimos. */
  protected readonly managed = computed(() => (this.users.value() ?? []).find((u) => u.id === this.managingId()) ?? null);

  protected readonly createForm = this.fb.group(
    {
      fullName: ['', [Validators.required, Validators.maxLength(120)]],
      roleId: ['', Validators.required],
      branchId: [ALL],
      pin: ['', Validators.pattern(PIN)],
      email: ['', [Validators.email, Validators.maxLength(200)]],
    },
    { validators: emailOrPin },
  );
  protected readonly roleForm = this.fb.group({ roleId: ['', Validators.required], branchId: [ALL] });
  protected readonly editForm = this.fb.group({
    fullName: ['', [Validators.required, Validators.maxLength(120)]],
    pin: ['', Validators.pattern(PIN)],
    isActive: [true],
  });

  private assignKey = newIdempotencyKey();

  protected current(u: UserDto): AssignmentDto[] {
    return u.assignments.filter((a) => a.isCurrent);
  }

  protected branchName(id: string | null): string {
    if (!id) return 'Todas las sucursales';
    return this.branches.value()?.find((b) => b.id === id)?.name ?? 'Sucursal';
  }

  protected openCreate(): void {
    this.action.error.set('');
    this.createForm.reset();
    this.creating.set(true);
  }

  protected async create(): Promise<void> {
    const v = this.createForm.getRawValue();
    const email = v.email.trim() || null;
    const r = await this.action.run(() => this.bo.createUser({
      fullName: v.fullName.trim(), email, pin: v.pin || null,
      assignments: [{ roleId: v.roleId, branchId: branchOf(v.branchId) }],
    }), 'Usuario creado');
    if (!r) return;
    this.creating.set(false);
    this.createForm.reset();
    this.users.reload();
    if (r.temporaryPassword) this.temporary.set({ name: r.user.fullName, email: email ?? '', password: r.temporaryPassword });
  }

  protected manage(u: UserDto): void {
    this.action.error.set('');
    this.roleForm.reset();
    this.editForm.reset({ fullName: u.fullName, pin: '', isActive: u.isActive });
    if (u.id === this.me) this.editForm.controls.isActive.disable();
    else this.editForm.controls.isActive.enable();
    this.managingId.set(u.id);
  }

  protected async assign(u: UserDto): Promise<void> {
    const v = this.roleForm.getRawValue();
    const a = await this.action.run(() => this.bo.addAssignment(u.id, { roleId: v.roleId, branchId: branchOf(v.branchId) }, this.assignKey), 'Rol agregado');
    if (a) { this.assignKey = newIdempotencyKey(); this.roleForm.reset(); this.users.reload(); }
  }

  protected async endAssignment(u: UserDto, a: AssignmentDto): Promise<void> {
    if (!confirm(`¿Quitar el rol ${a.roleName} (${this.branchName(a.branchId)}) a ${u.fullName}?`)) return;
    await this.action.run(() => this.bo.endAssignment(u.id, a.id), 'Rol quitado');
    if (!this.action.error()) this.users.reload();
  }

  protected async save(u: UserDto): Promise<void> {
    const v = this.editForm.getRawValue();
    const saved = await this.action.run(
      () => this.bo.updateUser(u.id, { fullName: v.fullName.trim(), isActive: v.isActive, pin: v.pin || null }, u.version),
      'Usuario guardado');
    if (saved) { this.managingId.set(null); this.users.reload(); }
  }

  protected copy(text: string): void {
    void navigator.clipboard?.writeText(text).then(() => this.toast.show('Copiada'), () => undefined);
  }
}

const branchOf = (v: string): string | null => (v === ALL ? null : v);
