import { Injectable, computed, inject, signal } from '@angular/core';
import { CashMovementDto, CashReasonDto, CashSessionSummaryDto } from '../api/api.models';
import { ApiError } from '../api/api-error';
import { PosApi } from '../api/pos-api';
import { ShiftStore } from './shift.store';

/**
 * Cash of the cash session (US-5.3, US-5.4): movements, reasons and summary. The expected amount is
 * computed by the server with all movements (sales included), so it is not recalculated here.
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
   * Records an income or withdrawal. A withdrawal cannot exceed the expected amount (the server validates it too)
   * and, if whoever is serving does not hold cash.withdrawal, it goes with the authorizing supervisor's token.
   */
  async register(kind: 'income' | 'expense', amount: number, reasonId: string, note: string | null, idempotencyKey: string, authorizerToken?: string): Promise<void> {
    if (!(amount > 0)) throw new ApiError('VALIDATION', 'El monto debe ser mayor a cero.', 400);
    if (kind === 'expense' && amount > this.expected()) {
      throw new ApiError('WITHDRAWAL_EXCEEDS_BALANCE', 'El retiro supera el efectivo esperado en caja.', 422);
    }
    await this.api.registerMovement(this.shifts.shift()!.id, { kind, amount, reasonId, note }, idempotencyKey, authorizerToken);
    await this.load();
  }
}
