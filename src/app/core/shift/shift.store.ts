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
 * Cash session (shift) open at this device's register (US-5.2). It is remembered locally so as not to
 * ask for it on every screen; the source of truth is the server (GET /cajas/{id}/sesion-abierta), which
 * allows cashier handover: whoever signs in resumes the session that is already open.
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

  /** Adopts the session the server has open at this register; null if there is none. */
  async resume(): Promise<OpenShift | null> {
    try {
      return this.adopt(await this.api.openSessionOf(this.registerId()));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return this.set(null);
      throw e;
    }
  }

  /** Closes with the counted cash; 422 PAGO_PENDIENTE if unresolved payments remain (D-12). */
  async close(countedCash: number, notes: string | null, idempotencyKey: string): Promise<CashSessionDto> {
    const closed = await this.api.closeSession(this._shift()!.id, countedCash, notes, idempotencyKey);
    this.forget();
    return closed;
  }

  /** Forgets the local session (without touching the server), e.g. when reassigning the device to another register. */
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
