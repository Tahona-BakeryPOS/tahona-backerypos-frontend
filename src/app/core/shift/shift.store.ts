import { Injectable, computed, inject, signal } from '@angular/core';
import { CashSessionDto } from '../api/api.models';
import { PosApi } from '../api/pos-api';
import { ApiError } from '../api/api-error';
import { DeviceConfigStore } from '../device/device-config.store';
import { LocalStore } from '../storage/local-store';

export interface OpenShift {
  id: string;
  cashRegisterId: string;
  openingAmount: number;
  openedAt: number;
  openedBy: string;
}

/**
 * Sesión de caja (turno) abierta en la caja de este equipo (HU-5.2). Se recuerda localmente para no
 * pedirla en cada pantalla; la fuente de verdad es el servidor (GET /cajas/{id}/sesion-abierta), que
 * permite el relevo de cajeros: quien entra retoma la sesión que ya está abierta.
 */
@Injectable({ providedIn: 'root' })
export class ShiftStore {
  private readonly api = inject(PosApi);
  private readonly device = inject(DeviceConfigStore);
  private readonly store = new LocalStore<OpenShift>('bakerypos.shift');
  private readonly _shift = signal<OpenShift | null>(this.store.read());

  readonly shift = this._shift.asReadonly();
  readonly isOpen = computed(() => this._shift() !== null);

  async open(openingAmount: number, idempotencyKey: string): Promise<OpenShift> {
    return this.adopt(await this.api.openSession(this.registerId(), openingAmount, idempotencyKey));
  }

  /** Adopta la sesión que el servidor tiene abierta en esta caja; null si no hay. */
  async resume(): Promise<OpenShift | null> {
    try {
      return this.adopt(await this.api.openSessionOf(this.registerId()));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return this.set(null);
      throw e;
    }
  }

  /** Cierra con el efectivo contado; 422 PAGO_PENDIENTE si quedan pagos sin resolver (D-12). */
  async close(countedCash: number, notes: string | null, idempotencyKey: string): Promise<CashSessionDto> {
    const closed = await this.api.closeSession(this._shift()!.id, countedCash, notes, idempotencyKey);
    this.forget();
    return closed;
  }

  /** Olvida la sesión local (sin tocar el servidor), p. ej. al reasignar el equipo a otra caja. */
  forget(): void {
    this.set(null);
  }

  private adopt(s: CashSessionDto): OpenShift {
    return this.set({
      id: s.id, cashRegisterId: s.cashRegisterId, openingAmount: s.openingAmount,
      openedAt: Date.parse(s.openedAt), openedBy: s.openedByName ?? '',
    });
  }

  private registerId(): string {
    return this.device.config()!.cashRegisterId;
  }

  private set<T extends OpenShift | null>(s: T): T {
    this._shift.set(s);
    this.store.write(s);
    return s;
  }
}
