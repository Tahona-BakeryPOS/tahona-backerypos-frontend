import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PosApi } from '../../core/api/pos-api';
import { toApiError } from '../../core/api/api-error';
import { DeviceConfigStore } from '../../core/device/device-config.store';
import { ShiftStore } from '../../core/shift/shift.store';

/**
 * Primera puesta en marcha de una caja. El propietario genera el código en
 * Backoffice → Mi negocio → Puntos de venta → Vincular dispositivo, y aquí se escribe.
 */
@Component({
  selector: 'app-pair-device-page',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .code { font: 700 32px/1 var(--mono); letter-spacing: .2em; text-align: center; text-transform: uppercase; min-height: 64px; }
    ol { margin: 8px 0 0; padding-left: 20px; color: var(--muted); font-size: 14px; display: grid; gap: 4px; }
  `,
  template: `
    <div class="center">
      <form class="card panel" (ngSubmit)="pair()">
        <div class="cu">Vincular dispositivo</div>
        <h1>Conecta esta caja</h1>
        <ol>
          <li>En el backoffice, entra a <b>Mi negocio → Puntos de venta</b>.</li>
          <li>Elige la caja y toca <b>Vincular dispositivo</b>.</li>
          <li>Escribe aquí el código de 8 caracteres. Vence en 15 minutos y sirve una sola vez.</li>
        </ol>
        <div class="field">
          <label for="code">Código de vinculación</label>
          <input id="code" name="code" class="code" [(ngModel)]="code" maxlength="9" autocomplete="off"
                 autocapitalize="characters" spellcheck="false" placeholder="K7PQ4R2X" required />
        </div>
        <div class="two">
          <div class="field"><label for="name">Nombre de este equipo</label><input id="name" name="name" [(ngModel)]="name" maxlength="80" /></div>
          <div class="field"><label for="prefix">Prefijo del ticket</label><input id="prefix" name="prefix" [(ngModel)]="prefix" maxlength="10" /></div>
        </div>
        <p class="err small" role="alert" style="min-height:18px">{{ error() }}</p>
        <button class="primary block" type="submit" [disabled]="busy()">{{ busy() ? 'Vinculando…' : 'Vincular' }}</button>
        <p class="hint">¿Eres el propietario? <a routerLink="/backoffice/ingresar">Entra al backoffice</a></p>
      </form>
    </div>
  `,
})
export class PairDevicePage {
  private readonly api = inject(PosApi);
  private readonly device = inject(DeviceConfigStore);
  private readonly shifts = inject(ShiftStore);
  private readonly router = inject(Router);

  protected code = '';
  protected name = 'Tablet caja';
  protected prefix = 'C1';
  protected readonly error = signal('');
  protected readonly busy = signal(false);

  protected async pair(): Promise<void> {
    const code = this.code.replace(/[^a-z0-9]/gi, '').toUpperCase();
    if (code.length !== 8) return this.error.set('El código tiene 8 caracteres, por ejemplo K7PQ4R2X.');
    this.busy.set(true);
    this.error.set('');
    try {
      const r = await this.api.pairDevice(code, this.name.trim() || 'Caja');
      // El turno guardado de otra caja no aplica a esta.
      if (this.device.config()?.cashRegisterId !== r.cashRegisterId) this.shifts.forget();
      this.device.save(DeviceConfigStore.fromPairing(r, this.prefix));
      void this.router.navigate(['/login']);
    } catch (e) {
      this.error.set(toApiError(e).message);
    } finally {
      this.busy.set(false);
    }
  }
}
