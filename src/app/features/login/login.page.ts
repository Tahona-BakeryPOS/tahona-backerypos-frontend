import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DeviceUserDto } from '../../core/api/api.models';
import { PosApi } from '../../core/api/pos-api';
import { toApiError } from '../../core/api/api-error';
import { SessionStore } from '../../core/auth/session.store';
import { DeviceConfigStore } from '../../core/device/device-config.store';
import { ShiftStore } from '../../core/shift/shift.store';
import { LocalStore } from '../../core/storage/local-store';
import { KeypadComponent, KeypadKey } from '../../shared/keypad.component';

const MAX_PIN = 6;

/**
 * Register sign-in (US-2.4): the person taps their name and enters their PIN. The list comes from the server
 * (users with a PIN and a current role at this device's branch, X-Device-Token header) and is
 * stored to show it even if the network drops. 5 failed PINs lock for 5 minutes (423).
 */
@Component({
  selector: 'app-login-page',
  imports: [KeypadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKey($event)' },
  styles: `
    .users { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; margin-top: 14px; }
    .user { display: grid; justify-items: center; gap: 6px; padding: 14px 8px; min-height: 120px; border-radius: 14px; }
    .avatar { width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; font-weight: 800;
      background: color-mix(in srgb, var(--brand) 18%, var(--surface)); color: var(--brand); }
    .who { display: flex; align-items: center; gap: 12px; }
    .who .avatar { width: 44px; height: 44px; }
  `,
  template: `
    <div class="center">
      <div class="card panel">
        <div class="cu">CU-01 · Iniciar sesión</div>
        <h1>🥐 BakeryPOS</h1>
        <p class="muted">{{ place() }}</p>

        @if (selected(); as u) {
          <div class="who">
            <span class="avatar" aria-hidden="true">{{ initials(u.fullName) }}</span>
            <div class="grow"><b>{{ u.fullName }}</b></div>
            <button type="button" class="ghost sm" (click)="choose(null)">Cambiar</button>
          </div>
          <div class="dots" aria-label="PIN">
            @for (i of slots; track i) { <i [class.on]="i < pin().length"></i> }
          </div>
          <p class="err small" role="alert" style="min-height:20px;text-align:center">{{ error() }}</p>
          <app-keypad (pressed)="press($event)" />
          @if (busy()) { <p class="hint">Verificando…</p> }
        } @else {
          <h2 style="margin-top:12px">¿Quién eres?</h2>
          <div class="users">
            @for (u of users(); track u.userId) {
              <button type="button" class="user" (click)="choose(u)">
                <span class="avatar" aria-hidden="true">{{ initials(u.fullName) }}</span>
                <b class="small">{{ u.fullName }}</b>
              </button>
            } @empty {
              <p class="muted small" style="grid-column:1/-1">{{ loading() ? 'Cargando usuarios…' : 'No hay usuarios asignados a esta sucursal.' }}</p>
            }
          </div>
          <p class="err small" role="alert">{{ error() }}</p>
        }
      </div>
    </div>
  `,
})
export class LoginPage {
  private readonly api = inject(PosApi);
  private readonly session = inject(SessionStore);
  private readonly shifts = inject(ShiftStore);
  private readonly router = inject(Router);
  private readonly cache = new LocalStore<DeviceUserDto[]>('bakerypos.device-users');
  protected readonly device = inject(DeviceConfigStore);

  protected readonly slots = Array.from({ length: MAX_PIN }, (_, i) => i);
  protected readonly users = signal<DeviceUserDto[]>(this.cache.read() ?? []);
  protected readonly selected = signal<DeviceUserDto | null>(null);
  protected readonly pin = signal('');
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly loading = signal(true);
  private readonly canSubmit = computed(() => this.pin().length >= 4 && !this.busy());
  protected readonly place = computed(() => {
    const c = this.device.config();
    return [c?.branchName, c?.cashRegisterName].filter(Boolean).join(' · ');
  });

  constructor() {
    void this.loadUsers();
  }

  protected initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  }

  protected choose(u: DeviceUserDto | null): void {
    this.selected.set(u);
    this.pin.set('');
    this.error.set('');
    if (!u) void this.loadUsers();
  }

  protected press(k: KeypadKey): void {
    if (this.busy() || !this.selected()) return;
    this.error.set('');
    if (k === 'back') this.pin.update((p) => p.slice(0, -1));
    else if (k === 'ok') void this.submit();
    else if (this.pin().length < MAX_PIN) this.pin.update((p) => p + k);
  }

  protected onKey(e: KeyboardEvent): void {
    if (!this.selected()) return;
    if (/^\d$/.test(e.key)) this.press(e.key as KeypadKey);
    else if (e.key === 'Backspace') this.press('back');
    else if (e.key === 'Enter') this.press('ok');
    else if (e.key === 'Escape') this.choose(null);
  }

  private async loadUsers(): Promise<void> {
    this.loading.set(true);
    try {
      const users = await this.api.deviceUsers(this.device.deviceToken()!);
      this.users.set(users);
      this.cache.write(users);
    } catch (e) {
      this.handleDeviceError(e);
    } finally {
      this.loading.set(false);
    }
  }

  private async submit(): Promise<void> {
    if (!this.canSubmit()) return this.error.set('El PIN tiene entre 4 y 6 dígitos.');
    this.busy.set(true);
    try {
      const r = await this.api.loginPin({ userId: this.selected()!.userId, pin: this.pin() }, this.device.deviceToken()!);
      this.session.start(r, 'pos');
      // Shifts and sales are still on the previous API: they are adapted in phases 5 and 8.
      void this.router.navigate([this.shifts.isOpen() ? '/pos' : '/turno']);
    } catch (e) {
      const err = toApiError(e);
      // 423 USUARIO_BLOQUEADO brings its own message with the wait.
      if (err.status === 401) this.error.set('PIN incorrecto.');
      else this.handleDeviceError(e);
    } finally {
      this.pin.set('');
      this.busy.set(false);
    }
  }

  /** An unpaired device (or one whose register was deactivated) goes back to the pairing screen. */
  private handleDeviceError(e: unknown): void {
    const err = toApiError(e);
    if (err.code === 'DISPOSITIVO_NO_VINCULADO') {
      this.device.unpair();
      void this.router.navigate(['/vincular']);
      return;
    }
    this.error.set(err.isNetwork ? 'Sin conexión: el inicio de sesión necesita el servidor.' : err.message);
  }
}
