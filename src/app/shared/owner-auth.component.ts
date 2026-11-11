import { ChangeDetectionStrategy, Component, inject, input, output, resource, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PosApi } from '../core/api/pos-api';
import { toApiError } from '../core/api/api-error';
import { Permission } from '../core/auth/permissions';
import { DeviceConfigStore } from '../core/device/device-config.store';

/**
 * A supervisor's authorization over the cashier's session: they choose their name, their PIN is validated against the
 * API and it hands over that session's token for the operation (it does not change the open session).
 */
@Component({
  selector: 'app-owner-auth',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field">
      <label for="ownerUser">Quién autoriza</label>
      <select id="ownerUser" [(ngModel)]="userId">
        <option value="">— elegir —</option>
        @for (u of users.value() ?? []; track u.userId) { <option [value]="u.userId">{{ u.fullName }}</option> }
      </select>
    </div>
    <div class="field">
      <label for="ownerPin">PIN</label>
      <input id="ownerPin" type="password" inputmode="numeric" maxlength="6" autocomplete="off" [(ngModel)]="pin" (keyup.enter)="authorize()" />
    </div>
    @if (error()) { <p class="err small">{{ error() }}</p> }
    <button type="button" class="block" (click)="authorize()" [disabled]="busy()">Autorizar</button>
  `,
})
export class OwnerAuthComponent {
  private readonly api = inject(PosApi);
  private readonly device = inject(DeviceConfigStore);

  readonly permission = input.required<Permission>();
  readonly authorized = output<string>();

  protected readonly users = resource({ loader: () => this.api.deviceUsers(this.device.deviceToken()!) });
  protected userId = '';
  protected pin = '';
  protected readonly error = signal('');
  protected readonly busy = signal(false);

  protected async authorize(): Promise<void> {
    if (!this.userId) return this.error.set('Elige quién autoriza.');
    this.error.set('');
    this.busy.set(true);
    try {
      const r = await this.api.loginPin({ userId: this.userId, pin: this.pin }, this.device.deviceToken()!);
      if (!r.permissions.includes(this.permission())) {
        this.error.set('Ese usuario tampoco tiene permiso para esta operación.');
        return;
      }
      this.authorized.emit(r.accessToken);
    } catch (e) {
      const err = toApiError(e);
      this.error.set(err.status === 401 ? 'PIN incorrecto.' : err.message);
    } finally {
      this.pin = '';
      this.busy.set(false);
    }
  }
}
