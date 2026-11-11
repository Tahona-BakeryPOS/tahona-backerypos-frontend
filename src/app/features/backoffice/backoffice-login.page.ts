import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthSessionDto } from '../../core/api/api.models';
import { PosApi } from '../../core/api/pos-api';
import { toApiError } from '../../core/api/api-error';
import { landingFor } from '../../core/auth/guards';
import { SessionStore } from '../../core/auth/session.store';

type Step = 'credentials' | 'password' | 'company';

/** The API's minimum (ChangePasswordValidator.MinLength). */
const MIN_PASSWORD = 10;

const sameAsNew = (g: AbstractControl): ValidationErrors | null =>
  g.get('newPassword')!.value === g.get('confirm')!.value ? null : { mismatch: true };

/**
 * Backoffice sign-in, from any device (it does not require a paired register):
 * email and password → mandatory change of the one-time password → choose a company if
 * there are several (D-08) or enter platform administration (D-09). If reloaded halfway
 * through, it resumes the pending step with the stored session.
 */
@Component({
  selector: 'app-backoffice-login-page',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .companies { display: grid; gap: 8px; margin-top: 12px; }
    .companies button { justify-content: flex-start; text-align: left; }
  `,
  template: `
    <div class="center">
      @switch (step()) {
        @case ('credentials') {
          <form class="card panel" [formGroup]="form" (ngSubmit)="submit()">
            <div class="cu">Backoffice</div>
            <h1>🥐 BakeryPOS</h1>
            <p class="muted">Entra con el correo y la contraseña de tu cuenta.</p>
            <div class="field"><label for="email">Correo</label><input id="email" type="email" formControlName="email" autocomplete="username" /></div>
            <div class="field"><label for="password">Contraseña</label><input id="password" type="password" formControlName="password" autocomplete="current-password" /></div>
            <p class="err small" role="alert" style="min-height:18px">{{ error() }}</p>
            <button class="primary block" type="submit" [disabled]="busy()">{{ busy() ? 'Entrando…' : 'Entrar' }}</button>
            <p class="hint"><a routerLink="/login">Ir a la caja</a></p>
          </form>
        }
        @case ('password') {
          <form class="card panel" [formGroup]="pwd" (ngSubmit)="changePassword()">
            <div class="cu">Primer ingreso</div>
            <h1>Crea tu contraseña</h1>
            <p class="muted">Hola, {{ session.user()?.name }}. La contraseña que recibiste solo sirve una vez: cámbiala para continuar.</p>
            <div class="field"><label for="current">Contraseña recibida</label><input id="current" type="password" formControlName="currentPassword" autocomplete="current-password" /></div>
            <div class="field"><label for="new">Nueva contraseña (mínimo {{ min }} caracteres)</label><input id="new" type="password" formControlName="newPassword" autocomplete="new-password" /></div>
            <div class="field"><label for="confirm">Repite la nueva contraseña</label><input id="confirm" type="password" formControlName="confirm" autocomplete="new-password" /></div>
            <p class="err small" role="alert" style="min-height:18px">{{ error() }}</p>
            <button class="primary block" type="submit" [disabled]="busy()">{{ busy() ? 'Guardando…' : 'Guardar y continuar' }}</button>
            <p class="hint"><a href="" (click)="$event.preventDefault(); cancel()">Salir</a></p>
          </form>
        }
        @case ('company') {
          <div class="card panel">
            <div class="cu">Backoffice</div>
            <h1>¿Dónde vas a trabajar?</h1>
            <p class="muted">Tu cuenta tiene acceso a varias empresas. Puedes cambiar después desde el menú.</p>
            <div class="companies">
              @for (c of session.user()?.companies ?? []; track c.id) {
                <button type="button" class="block" [disabled]="busy()" (click)="chooseCompany(c.id)"><b>{{ c.name }}</b></button>
              }
              @if (session.user()?.isPlatformAdmin) {
                <button type="button" class="block ghost" [disabled]="busy()" (click)="choosePlatform()">Administración de la plataforma</button>
              }
            </div>
            <p class="err small" role="alert" style="min-height:18px">{{ error() }}</p>
            <p class="hint"><a href="" (click)="$event.preventDefault(); cancel()">Salir</a></p>
          </div>
        }
      }
    </div>
  `,
})
export class BackofficeLoginPage {
  private readonly api = inject(PosApi);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly session = inject(SessionStore);
  protected readonly min = MIN_PASSWORD;

  protected readonly step = signal<Step>('credentials');
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected readonly pwd = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(MIN_PASSWORD)]],
      confirm: ['', Validators.required],
    },
    { validators: sameAsNew },
  );

  constructor() {
    // ?paso=empresa: switch company from the menu. Without it, it resumes a half-finished sign-in.
    const u = this.session.user();
    const switching = inject(ActivatedRoute).snapshot.queryParamMap.get('paso') === 'empresa';
    if (u?.kind === 'backoffice') {
      if (u.mustChangePassword) this.step.set('password');
      else if (switching || (!u.companyId && this.needsCompany(u))) this.step.set('company');
    }
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) return this.error.set('Escribe un correo válido y la contraseña.');
    await this.run(async () => this.proceed(await this.api.loginPassword(this.form.getRawValue())), (e) => {
      const err = toApiError(e);
      // 423 USUARIO_BLOQUEADO and 429 bring their own message with the wait.
      return err.status === 401 ? 'Correo o contraseña incorrectos.' : err.message;
    });
    this.form.controls.password.reset();
  }

  protected async changePassword(): Promise<void> {
    if (this.pwd.controls.newPassword.invalid) return this.error.set(`La nueva contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
    if (this.pwd.hasError('mismatch')) return this.error.set('Las dos contraseñas nuevas no coinciden.');
    if (this.pwd.invalid) return this.error.set('Escribe la contraseña que recibiste.');
    const v = this.pwd.getRawValue();
    await this.run(async () => this.proceed(await this.api.changePassword(v.currentPassword, v.newPassword)));
    this.pwd.reset();
  }

  protected chooseCompany(companyId: string): Promise<void> {
    return this.run(async () => this.proceed(await this.api.selectCompany(companyId, this.session.refreshToken())));
  }

  /** The administrator's session without a company is already the platform one. */
  protected choosePlatform(): void {
    if (this.session.user()?.companyId) {
      // From a company session there is no endpoint to return to the platform one: sign in again.
      this.cancel();
      return;
    }
    void this.router.navigateByUrl(landingFor(this.session));
  }

  protected cancel(): void {
    const refresh = this.session.refreshToken();
    if (refresh) void this.api.logout(refresh).catch(() => undefined);
    this.session.end();
    this.error.set('');
    this.step.set('credentials');
  }

  private proceed(s: AuthSessionDto): void {
    this.session.start(s, 'backoffice');
    if (s.mustChangePassword) return this.step.set('password');
    if (!s.companyId && this.needsCompany(this.session.user()!)) return this.step.set('company');
    void this.router.navigateByUrl(landingFor(this.session));
  }

  private needsCompany(u: { companies: unknown[]; isPlatformAdmin: boolean }): boolean {
    return u.companies.length > 1 || (u.isPlatformAdmin && u.companies.length > 0);
  }

  private async run(fn: () => Promise<void>, message: (e: unknown) => string = (e) => toApiError(e).message): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await fn();
    } catch (e) {
      this.error.set(message(e));
    } finally {
      this.busy.set(false);
    }
  }
}
