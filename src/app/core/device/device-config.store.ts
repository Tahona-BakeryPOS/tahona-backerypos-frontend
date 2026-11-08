import { Injectable, computed, signal } from '@angular/core';
import { DeviceSetupDto, PairedDeviceDto } from '../api/api.models';
import { LocalStore } from '../storage/local-store';

export type PaymentKind = DeviceSetupDto['paymentMethods'][number]['kind'];
export type PaymentMethodConfig = DeviceSetupDto['paymentMethods'][number];
export type CashReasonConfig = DeviceSetupDto['cashReasons'][number];

/**
 * Este dispositivo, vinculado a una caja con un código del backoffice. Guarda su credencial
 * (token de dispositivo) y la configuración operativa para trabajar sin conexión.
 */
export interface DeviceConfig {
  deviceId: string;
  /** Token de dispositivo: habilita el login por PIN y la lista de cajeros. */
  deviceToken: string;
  companyId: string;
  branchId: string;
  /** La vinculación v2 no devuelve el nombre de la sucursal: vacío hasta que un endpoint lo entregue. */
  branchName: string;
  cashRegisterId: string;
  cashRegisterName: string;
  /** Prefijo del consecutivo local del ticket (p. ej. "C1"). */
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
  /** Medios de pago y motivos llegan en fases posteriores; para entrar con PIN basta el token. */
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

  /** Refresca medios de pago y motivos sin perder la vinculación. */
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

  /** Configuraciones anteriores (sin token, o de la v1 sin empresa) obligan a vincular de nuevo. */
  private read(): DeviceConfig | null {
    const c = this.store.read();
    return c?.deviceToken && c.companyId ? c : null;
  }
}
