import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, resource, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { PairingCodeDto } from '../../../core/api/api.models';
import { BackofficeApi } from '../../../core/api/backoffice-api';
import { AsyncAction } from '../../../shared/async-action';
import { ModalComponent } from '../../../shared/modal.component';
import { ToastService } from '../../../shared/toast.service';
import { BO_PAGE_STYLES } from '../backoffice.styles';

/**
 * Mi negocio → Points of sale: each register with its devices. "Vincular dispositivo" generates a code
 * of 8 characters, single use and valid for 15 minutes, which is typed on the device; "Desvincular"
 * revokes that device's token.
 */
@Component({
  selector: 'app-points-of-sale-page',
  imports: [DatePipe, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [BO_PAGE_STYLES, `
    .register { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 14px; border-bottom: 1px solid var(--line); }
    .register:last-child { border-bottom: 0; }
    .devices { grid-column: 1 / -1; display: grid; gap: 6px; }
    .device { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; align-items: center; padding: 8px 10px; border-radius: 10px; background: var(--surface2); font-size: 14px; }
    .branch { margin-bottom: 16px; }
    .branch h2 { font-size: 16px; padding: 14px 14px 0; }
    .code { font: 800 40px/1 var(--mono); letter-spacing: .12em; text-align: center; padding: 18px 8px; border: 2px dashed var(--brand); border-radius: 14px; color: var(--brand); margin: 12px 0; overflow-wrap: anywhere; }
  `],
  template: `
    <div class="head"><div><h1>Puntos de venta</h1><p>Vincula cada tablet o PC a una caja. En ese equipo, cada persona entra tocando su nombre y digitando su PIN.</p></div></div>
    @for (b of view(); track b.id) {
      <section class="card branch">
        <h2>{{ b.name }}@if (!b.isActive) { <span class="badge">inactiva</span> }</h2>
        @for (r of b.registers; track r.id) {
          <div class="register">
            <div><b>{{ r.name }}</b> <span class="small muted">· {{ r.code }}</span></div>
            <button type="button" class="primary sm" (click)="pair(r.id, b.name, r.name)" [disabled]="action.busy() || !r.isActive">Vincular dispositivo</button>
            <div class="devices">
              @for (d of r.devices; track d.id) {
                <div class="device">
                  <span>{{ d.name }} <span class="small muted">· vinculado {{ d.createdAt | date: 'dd/MM/yyyy' }}@if (d.lastSeenAt) { · último uso {{ d.lastSeenAt | date: 'dd/MM HH:mm' }} }</span></span>
                  @if (d.isActive) {
                    <button type="button" class="ghost sm" (click)="unpair(d.id, d.name)" [disabled]="action.busy()">Desvincular</button>
                  } @else { <span class="badge">desvinculado</span> }
                </div>
              } @empty { <span class="small muted">Sin dispositivos vinculados</span> }
            </div>
          </div>
        } @empty { <p class="state">Esta sucursal no tiene cajas. Créalas en Sucursales y cajas.</p> }
      </section>
    } @empty { <p class="state">{{ branches.isLoading() ? 'Cargando…' : 'Aún no hay sucursales.' }}</p> }
    @if (action.error()) { <p class="err" role="alert">{{ action.error() }}</p> }

    @if (code(); as c) {
      <app-modal title="Vincular dispositivo" [eyebrow]="c.place" (closed)="closeCode()">
        <p>En el equipo abre BakeryPOS y escribe este código:</p>
        <div class="code" aria-live="polite">{{ c.dto.code }}</div>
        <p class="small muted">
          @if (secondsLeft() > 0) { Vence en {{ minutes() }}. Solo sirve una vez. }
          @else { <b class="err">El código venció. Genera otro.</b> }
        </p>
        <div class="actions"><button type="button" class="primary" (click)="closeCode()">Listo</button></div>
      </app-modal>
    }
  `,
})
export class PointsOfSalePage {
  private readonly bo = inject(BackofficeApi);
  protected readonly action = new AsyncAction(inject(ToastService));
  protected readonly branches = resource({ loader: () => this.bo.branches() });
  protected readonly registers = resource({ loader: () => this.bo.cashRegisters() });
  protected readonly devices = resource({ loader: () => this.bo.devices() });
  protected readonly code = signal<{ dto: PairingCodeDto; place: string } | null>(null);
  private readonly now = signal(Date.now());

  protected readonly view = computed(() => {
    const devices = this.devices.value() ?? [];
    const registers = this.registers.value() ?? [];
    return (this.branches.value() ?? []).map((b) => ({
      id: b.id, name: b.name, isActive: b.isActive,
      registers: registers.filter((r) => r.branchId === b.id).map((r) => ({ ...r, devices: devices.filter((d) => d.cashRegisterId === r.id) })),
    }));
  });
  protected readonly secondsLeft = computed(() => {
    const c = this.code();
    return c ? Math.max(0, Math.round((Date.parse(c.dto.expiresAt) - this.now()) / 1000)) : 0;
  });
  protected readonly minutes = computed(() => {
    const s = this.secondsLeft();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });

  constructor() {
    const id = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  protected async pair(cashRegisterId: string, branchName: string, registerName: string): Promise<void> {
    const c = await this.action.run(() => this.bo.createPairingCode(cashRegisterId));
    if (c) this.code.set({ dto: c, place: `${branchName} · ${registerName}` });
  }

  protected closeCode(): void {
    this.code.set(null);
    this.devices.reload();
  }

  protected async unpair(id: string, name: string): Promise<void> {
    if (!confirm(`¿Desvincular ${name}? Ese equipo tendrá que vincularse de nuevo con un código.`)) return;
    await this.action.run(() => this.bo.deactivateDevice(id), `${name} desvinculado`);
    this.devices.reload();
  }
}
