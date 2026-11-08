import { ChangeDetectionStrategy, Component, effect, inject, resource } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BackofficeApi } from '../../../core/api/backoffice-api';
import { AsyncAction } from '../../../shared/async-action';
import { ToastService } from '../../../shared/toast.service';
import { BO_PAGE_STYLES } from '../backoffice.styles';

/**
 * Mi negocio → Empresa (HU-1.2). Razón social, NIT y datos fiscales los fija la plataforma en el alta
 * y aquí solo se ven; el propietario edita nombre comercial, contacto y zona horaria. El guardado
 * envía la versión leída (If-Match): si otra persona cambió la empresa, la API responde 412.
 */
@Component({
  selector: 'app-company-page',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [BO_PAGE_STYLES, `
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; margin: 0 0 8px; font-size: 14px; }
    dt { color: var(--muted); }
    dd { margin: 0; }
  `],
  template: `
    <div class="head"><div><h1>Empresa</h1><p>Estos datos salen en los comprobantes y en la facturación electrónica.</p></div></div>
    @if (company.error()) {
      <p class="err" role="alert">{{ loadError() }}</p>
    } @else if (company.value(); as c) {
      <div class="grid-2">
        <form class="card pad" [formGroup]="form" (ngSubmit)="save()">
          <h2>Contacto</h2>
          <div class="field"><label for="trade">Nombre comercial</label><input id="trade" formControlName="tradeName" [placeholder]="c.legalName" /></div>
          <div class="field"><label for="email">Correo</label><input id="email" type="email" formControlName="email" /></div>
          <div class="two">
            <div class="field"><label for="phone">Teléfono</label><input id="phone" formControlName="phone" inputmode="tel" /></div>
            <div class="field"><label for="city">Código de ciudad (DANE)</label><input id="city" formControlName="cityCode" inputmode="numeric" maxlength="5" /></div>
          </div>
          <div class="field"><label for="address">Dirección</label><input id="address" formControlName="address" /></div>
          <div class="field"><label for="tz">Zona horaria</label><input id="tz" formControlName="timeZone" placeholder="America/Bogota" /></div>
          <p class="err small" role="alert" style="min-height:18px">{{ action.error() }}</p>
          <div class="row">
            <button class="primary" type="submit" [disabled]="form.invalid || form.pristine || action.busy()">Guardar cambios</button>
            @if (action.error()) { <button type="button" (click)="company.reload()">Recargar</button> }
          </div>
        </form>
        <section class="card pad">
          <h2>Datos fiscales</h2>
          <dl>
            <dt>Razón social</dt><dd>{{ c.legalName }}</dd>
            <dt>NIT</dt><dd>{{ c.nit }}-{{ c.nitCheckDigit }}</dd>
            <dt>Régimen</dt><dd>{{ c.taxRegime }}</dd>
            <dt>Responsabilidades</dt><dd>{{ c.taxResponsibilities.join(', ') }}</dd>
            <dt>Moneda</dt><dd>{{ c.currency }}</dd>
            <dt>Estado</dt><dd><span class="badge" [class.ok]="c.status === 'active'">{{ c.status }}</span></dd>
          </dl>
          <p class="small muted">Para corregirlos, escríbele al administrador de la plataforma.</p>
        </section>
      </div>
    } @else {
      <p class="state">Cargando…</p>
    }
  `,
})
export class CompanyPage {
  private readonly bo = inject(BackofficeApi);
  protected readonly action = new AsyncAction(inject(ToastService));
  protected readonly company = resource({ loader: () => this.bo.company() });
  protected readonly form = inject(FormBuilder).nonNullable.group({
    tradeName: ['', Validators.maxLength(200)],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(200)]],
    phone: ['', Validators.maxLength(30)],
    address: [''],
    cityCode: ['', Validators.pattern(/^\d{5}$/)],
    timeZone: [''],
  });

  constructor() {
    effect(() => {
      const c = this.company.value();
      if (c) this.form.reset({
        tradeName: c.tradeName ?? '', email: c.email, phone: c.phone ?? '', address: c.address ?? '',
        cityCode: c.cityCode ?? '', timeZone: c.timeZone,
      });
    });
  }

  protected loadError(): string {
    return (this.company.error() as Error)?.message ?? 'No se pudo cargar la empresa.';
  }

  protected async save(): Promise<void> {
    const c = this.company.value();
    if (!c) return;
    const v = this.form.getRawValue();
    const saved = await this.action.run(
      () => this.bo.updateCompany({
        tradeName: v.tradeName.trim() || null, email: v.email.trim(), phone: v.phone.trim() || null,
        address: v.address.trim() || null, cityCode: v.cityCode.trim() || null, timeZone: v.timeZone.trim() || null,
      }, c.version),
      'Datos de la empresa guardados',
    );
    if (saved) this.company.set(saved);
  }
}
