import { Injectable, computed, signal } from '@angular/core';
import { DeviceSetupDto, PairedDeviceDto } from '../api/api.models';
import { LocalStore } from '../storage/local-store';

export type PaymentKind = DeviceSetupDto['paymentMethods'][number]['kind'];
export type PaymentMethodConfig = DeviceSetupDto['paymentMethods'][number];
export type CashReasonConfig = DeviceSetupDto['cashReasons'][number];

/**
 * This device, paired to a register with a code from the backoffice. It stores its credential
 * (device token) and the operating configuration.
 */
export interface DeviceConfig {
  deviceId: string;
  /** Device token: it enables PIN login and the cashier list. */
  deviceToken: string;
  companyId: string;
  branchId: string;
  /** Pairing does not return the branch name: empty until an endpoint delivers it. */
  branchName: string;
  cashRegisterId: string;
  cashRegisterName: string;
  /** Prefix of the ticket's local consecutive number (e.g. "C1"). */
  ticketPrefix: string;
  priceListId: string | null;
  paymentMethods: PaymentMethodConfig[];
  cashReasons: CashReasonConfig[];
}

@Injectable({ providedIn: 'root' })
export class DeviceConfigStore {
  private readonly store = new LocalStore<DeviceConfig>('bakerypos.device');
  private readonly _config = signal<DeviceConfig | null>(this.read());

  readonly config = this._config.asReadonly();
  /** Payment methods and reasons arrive in later phases; to sign in with a PIN the token is enough. */
  readonly isPaired = computed(() => {
    const c = this._config();
    return !!c?.deviceToken && !!c.cashRegisterId;
  });
  readonly paymentMethods = computed(() => this._config()?.paymentMethods ?? []);
  readonly cashReasons = computed(() => this._config()?.cashReasons ?? []);
  readonly deviceToken = computed(() => this._config()?.deviceToken ?? null);

  save(c: DeviceConfig): void {
    this._config.set(c);
    this.store.write(c);
  }

  /** Refreshes payment methods and reasons without losing the pairing. */
  updateSetup(setup: DeviceSetupDto): void {
    const c = this._config();
    if (c) this.save({ ...c, branchName: setup.branchName, priceListId: setup.defaultPriceListId, paymentMethods: setup.paymentMethods, cashReasons: setup.cashReasons });
  }

  unpair(): void {
    this._config.set(null);
    this.store.write(null);
  }

  method(id: string): PaymentMethodConfig | undefined {
    return this.paymentMethods().find((m) => m.id === id);
  }

  static fromPairing(r: PairedDeviceDto, ticketPrefix: string): DeviceConfig {
    return {
      deviceId: r.deviceId,
      deviceToken: r.deviceToken,
      companyId: r.companyId,
      branchId: r.branchId,
      branchName: '',
      cashRegisterId: r.cashRegisterId,
      cashRegisterName: r.cashRegisterName,
      ticketPrefix: ticketPrefix.trim().toUpperCase() || 'POS',
      priceListId: null,
      paymentMethods: [],
      cashReasons: [],
    };
  }

  /** Earlier configurations (without a token, or from the previous system without a company) force pairing again. */
  private read(): DeviceConfig | null {
    const c = this.store.read();
    return c?.deviceToken && c.companyId ? c : null;
  }
}
