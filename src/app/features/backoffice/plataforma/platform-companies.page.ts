import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BackofficeApi } from '../../../core/api/backoffice-api';
import { AsyncAction } from '../../../shared/async-action';
import { ModalComponent } from '../../../shared/modal.component';
import { ToastService } from '../../../shared/toast.service';
import { BO_PAGE_STYLES } from '../backoffice.styles';

/** Códigos del anexo técnico DIAN que valida la API (I-16; verificar con el contador antes de la fase 7). */
const REGIMES = [
  { code: '48', name: '48 · Responsable de IVA' },
  { code: '49', name: '49 · No responsable de IVA' },
];
const RESPONSIBILITIES = [
  { code: 'O-13', name: 'O-13 · Gran contribuyente' },
  { code: 'O-15', name: 'O-15 · Autorretenedor' },
  { code: 'O-23', name: 'O-23 · Agente de retención IVA' },
  { code: 'O-47', name: 'O-47 · Régimen simple de tributación' },
  { code: 'R-99-PN', name: 'R-99-PN · No aplica (otros)' },
];

/** Dígito de verificación del NIT (DIAN, módulo 11). Se propone; el operador puede corregirlo. */
export function nitCheckDigit(nit: string): number | null {
  const digits = nit.replace(/\D/g, '');
  if (!digits || digits.length > 15) return null;
  const weights = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  let sum = 0;
  [...digits].reverse().forEach((d, i) => (sum += Number(d) * weights[i]));
  const r = sum % 11;
  return r > 1 ? 11 - r : r;
}

/**
 * Plataforma → Empresas (D-09): el administrador de la plataforma da de alta empresas y su
 * propietario. La respuesta trae la contraseña de un solo uso del propietario, que se muestra una
 * sola vez; por eso el alta no usa Idempotency-Key (I-14) y un reintento choca con NIT_DUPLICADO.
 */
@Component({
  selector: 'app-platform-companies-page',
  imports: [ReactiveFormsModule, ModalComponent, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [BO_PAGE_STYLES, `
    .checks { display: grid; gap: 4px; margin-bottom: 8px; }
    .checks label { display: flex; gap: 8px; align-items: center; font-size: 14px; }
    .checks input { width: auto; min-height: auto; }
    .secret { font: 700 22px/1.2 var(--mono); text-align: center; padding: 14px; border: 2px dashed var(--brand); border-radius: 12px; margin: 10px 0; user-select: all; overflow-wrap: anywhere; }
  `],
  template: `
    <div class="head">
      <div><h1>Empresas</h1><p>Alta de empresas clientes y de su propietario. La plataforma no ve la operación de cada empresa.</p></div>
      <button type="button" class="primary" (click)="openCreate()">＋ Nueva empresa</button>
    </div>
    <div class="card scroll-x">
      <table>
        <thead><tr><th>Empresa</th><th>NIT</th><th>Estado</th><th>Alta</th></tr></thead>
        <tbody>
          @for (c of companies.value() ?? []; track c.id) {
            <tr>
              <td><b>{{ c.tradeName || c.legalName }}</b>@if (c.tradeName) { <div class="small muted">{{ c.legalName }}</div> }</td>
              <td>{{ c.nit }}-{{ c.nitCheckDigit }}</td>
              <td><span class="badge" [class.ok]="c.status === 'active'">{{ c.status }}</span></td>
              <td>{{ c.createdAt | date: 'dd/MM/yyyy' }}</td>
            </tr>
          } @empty { <tr><td colspan="4" class="state">{{ companies.isLoading() ? 'Cargando…' : 'Aún no hay empresas.' }}</td></tr> }
        </tbody>
      </table>
    </div>

    @if (creating()) {
      <app-modal title="Nueva empresa" eyebrow="Plataforma" (closed)="creating.set(false)">
        <form [formGroup]="form" (ngSubmit)="create()">
          <div class="field"><label for="legal">Razón social</label><input id="legal" formControlName="legalName" /></div>
          <div class="field"><label for="trade">Nombre comercial (opcional)</label><input id="trade" formControlName="tradeName" /></div>
          <div class="two">
            <div class="field"><label for="nit">NIT (sin dígito de verificación)</label><input id="nit" formControlName="nit" inputmode="numeric" (input)="suggestDv()" /></div>
            <div class="field"><label for="dv">Dígito de verificación</label><input id="dv" type="number" min="0" max="9" formControlName="nitCheckDigit" /></div>
          </div>
          <div class="field"><label for="regime">Régimen fiscal</label>
            <select id="regime" formControlName="taxRegime">@for (r of regimes; track r.code) { <option [value]="r.code">{{ r.name }}</option> }</select></div>
          <fieldset class="checks"><legend class="small">Responsabilidades fiscales</legend>
            @for (r of responsibilities; track r.code) {
              <label><input type="checkbox" [checked]="selected().has(r.code)" (change)="toggle(r.code)" /> {{ r.name }}</label>
            }
          </fieldset>
          <div class="two">
            <div class="field"><label for="cEmail">Correo de la empresa</label><input id="cEmail" type="email" formControlName="email" /></div>
            <div class="field"><label for="cPhone">Teléfono</label><input id="cPhone" formControlName="phone" inputmode="tel" /></div>
          </div>
          <div class="two">
            <div class="field"><label for="cAddr">Dirección</label><input id="cAddr" formControlName="address" /></div>
            <div class="field"><label for="cCity">Código de ciudad (DANE)</label><input id="cCity" formControlName="cityCode" inputmode="numeric" maxlength="5" /></div>
          </div>
          <h3 style="font-size:15px;margin-top:8px">Propietario</h3>
          <div class="two">
            <div class="field"><label for="oName">Nombre completo</label><input id="oName" formControlName="ownerName" /></div>
            <div class="field"><label for="oEmail">Correo</label><input id="oEmail" type="email" formControlName="ownerEmail" autocomplete="off" /></div>
          </div>
          <p class="err small" role="alert">{{ action.error() }}</p>
          <div class="actions"><button type="button" (click)="creating.set(false)">Cancelar</button>
            <button type="submit" class="primary" [disabled]="form.invalid || !selected().size || action.busy()">Crear empresa</button></div>
        </form>
      </app-modal>
    }

    @if (created(); as c) {
      <app-modal title="Empresa creada" [eyebrow]="c.company" (closed)="created.set(null)">
        @if (c.password) {
          <p>Entrégale al propietario (<b>{{ c.email }}</b>) esta contraseña de un solo uso. Al entrar deberá cambiarla.</p>
          <div class="secret">{{ c.password }}</div>
          <p class="small warn">No se vuelve a mostrar: cópiala ahora.</p>
        } @else {
          <p><b>{{ c.email }}</b> ya tenía cuenta: entra con su contraseña actual y verá la nueva empresa.</p>
        }
        <div class="actions">
          @if (c.password) { <button type="button" (click)="copy(c.password)">Copiar</button> }
          <button type="button" class="primary" (click)="created.set(null)">Listo</button>
        </div>
      </app-modal>
    }
  `,
})
export class PlatformCompaniesPage {
  private readonly bo = inject(BackofficeApi);
  private readonly toast = inject(ToastService);
  protected readonly action = new AsyncAction(this.toast);
  protected readonly companies = resource({ loader: () => this.bo.platformCompanies() });
  protected readonly regimes = REGIMES;
  protected readonly responsibilities = RESPONSIBILITIES;
  protected readonly creating = signal(false);
  protected readonly selected = signal(new Set<string>(['R-99-PN']));
  protected readonly created = signal<{ company: string; email: string; password: string | null } | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    legalName: ['', [Validators.required, Validators.maxLength(200)]],
    tradeName: ['', Validators.maxLength(200)],
    nit: ['', [Validators.required, Validators.pattern(/^[0-9.]{6,20}$/)]],
    nitCheckDigit: [0, [Validators.required, Validators.min(0), Validators.max(9)]],
    taxRegime: ['49', Validators.required],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(200)]],
    phone: ['', Validators.maxLength(30)],
    address: ['', Validators.maxLength(200)],
    cityCode: ['', Validators.pattern(/^\d{5}$/)],
    ownerName: ['', [Validators.required, Validators.maxLength(120)]],
    ownerEmail: ['', [Validators.required, Validators.email]],
  });

  protected openCreate(): void {
    this.action.error.set('');
    this.form.reset();
    this.selected.set(new Set(['R-99-PN']));
    this.creating.set(true);
  }

  protected suggestDv(): void {
    const dv = nitCheckDigit(this.form.controls.nit.value);
    if (dv !== null) this.form.controls.nitCheckDigit.setValue(dv);
  }

  protected toggle(code: string): void {
    this.selected.update((s) => {
      const next = new Set(s);
      if (!next.delete(code)) next.add(code);
      return next;
    });
  }

  protected async create(): Promise<void> {
    const v = this.form.getRawValue();
    const r = await this.action.run(() => this.bo.createCompany({
      legalName: v.legalName.trim(), tradeName: v.tradeName.trim() || null, nit: v.nit.replace(/\./g, ''),
      nitCheckDigit: Number(v.nitCheckDigit), taxRegime: v.taxRegime, taxResponsibilities: [...this.selected()],
      email: v.email.trim(), phone: v.phone.trim() || null, address: v.address.trim() || null,
      cityCode: v.cityCode.trim() || null, timeZone: null,
      owner: { fullName: v.ownerName.trim(), email: v.ownerEmail.trim() },
    }), 'Empresa creada');
    if (!r) return;
    this.creating.set(false);
    this.companies.reload();
    this.created.set({ company: r.company.tradeName || r.company.legalName, email: r.owner.email, password: r.owner.temporaryPassword });
  }

  protected copy(text: string): void {
    void navigator.clipboard?.writeText(text).then(() => this.toast.show('Copiada'), () => undefined);
  }
}
