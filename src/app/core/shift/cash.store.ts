import { Injectable, computed, inject, signal } from '@angular/core';
import { CashMovementDto, CashReasonDto, CashSessionSummaryDto } from '../api/api.models';
import { ApiError } from '../api/api-error';
import { PosApi } from '../api/pos-api';
import { ShiftStore } from './shift.store';

/**
 * Efectivo de la sesión de caja (HU-5.3, HU-5.4): movimientos, motivos y resumen. El esperado lo
 * calcula el servidor con todos los movimientos (ventas incluidas), así que aquí no se recalcula.
 */
@Injectable({ providedIn: 'root' })
export class CashStore {
  private readonly api = inject(PosApi);
  private readonly shifts = inject(ShiftStore);

  readonly movements = signal<CashMovementDto[]>([]);
  readonly summary = signal<CashSessionSummaryDto | null>(null);
  readonly reasons = signal<CashReasonDto[]>([]);
  readonly loadError = signal<string | null>(null);

  readonly expected = computed(() => this.summary()?.expected ?? 0);

  async load(): Promise<void> {
    const shift = this.shifts.shift();
    if (!shift) return;
    try {
      const [movements, summary, reasons] = await Promise.all([
        this.api.movements(shift.id), this.api.sessionSummary(shift.id), this.api.cashReasons(),
      ]);
      this.movements.set(movements);
      this.summary.set(summary);
      this.reasons.set(reasons.filter((r) => r.isActive));
      this.loadError.set(null);
    } catch (e) {
      this.loadError.set((e as ApiError).message);
    }
  }

  /**
   * Registra un ingreso o retiro. El retiro no puede superar el esperado (también lo valida el servidor)
   * y, si quien atiende no tiene caja.retiro, va con el token del superior que autoriza.
   */
  async register(kind: 'income' | 'expense', amount: number, reasonId: string, note: string | null, idempotencyKey: string, authorizerToken?: string): Promise<void> {
    if (!(amount > 0)) throw new ApiError('VALIDACION', 'El monto debe ser mayor a cero.', 400);
    if (kind === 'expense' && amount > this.expected()) {
      throw new ApiError('RETIRO_EXCEDE_SALDO', 'El retiro supera el efectivo esperado en caja.', 422);
    }
    await this.api.registerMovement(this.shifts.shift()!.id, { kind, amount, reasonId, note }, idempotencyKey, authorizerToken);
    await this.load();
  }
}
