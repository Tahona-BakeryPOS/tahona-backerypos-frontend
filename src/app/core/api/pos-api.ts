import { Injectable, inject } from '@angular/core';
import { ApiClient, newIdempotencyKey } from './api-client';
import {
  AuthSessionDto, CashMovementDto, CashReasonDto, CashSessionDto, CashSessionSummaryDto, DeviceUserDto,
  LoginPasswordRequest, LoginPinRequest, PagedResult, PairedDeviceDto, PaymentMethodDto, PosProduct, ProductDto, SaleDto, SaleLineInput,
  SaleListItemV2, SaleReturnLineInput,
} from './api.models';

/** Header with the opaque token of the paired device (PIN login and the cashier list). */
export const DEVICE_TOKEN_HEADER = 'X-Device-Token';

const device = (token: string) => ({ headers: { [DEVICE_TOKEN_HEADER]: token } });

/**
 * Gateway of the register (POS) and of the sessions. Components and stores do not use HttpClient directly:
 * the contract lives in a single place and all errors come out as ApiError.
 * API: device and sessions (phase 2), cash sessions (phase 5), sale and payment (phase 8). The
 * reports come from the previous system and are adapted in phase 9.
 */
@Injectable({ providedIn: 'root' })
export class PosApi {
  private readonly api = inject(ApiClient);

  // Dispositivo
  pairDevice(code: string, deviceName: string): Promise<PairedDeviceDto> {
    return this.api.post('/dispositivo/vincular', { code, deviceName });
  }

  deviceUsers(deviceToken: string): Promise<DeviceUserDto[]> {
    return this.api.get('/dispositivo/usuarios', undefined, device(deviceToken));
  }

  // Sesiones
  loginPin(body: LoginPinRequest, deviceToken: string): Promise<AuthSessionDto> {
    return this.api.post('/auth/login-pin', body, device(deviceToken));
  }

  loginPassword(body: LoginPasswordRequest): Promise<AuthSessionDto> {
    return this.api.post('/auth/login', body);
  }

  /** Issues tokens for one of the user's companies; revokes the previous refresh token. */
  selectCompany(companyId: string, refreshToken: string | null): Promise<AuthSessionDto> {
    return this.api.post('/auth/select-company', { companyId, refreshToken });
  }

  changePassword(currentPassword: string, newPassword: string): Promise<AuthSessionDto> {
    return this.api.post('/auth/cambiar-contrasena', { currentPassword, newPassword });
  }

  logout(refreshToken: string): Promise<void> {
    return this.api.post('/auth/logout', { refreshToken });
  }

  // Cash sessions (phase 5)
  openSession(cashRegisterId: string, openingAmount: number, idempotencyKey = newIdempotencyKey()): Promise<CashSessionDto> {
    return this.api.post(`/cajas/${cashRegisterId}/sesiones`, { openingAmount }, { idempotencyKey });
  }

  /** The register's open session; ApiError NO_ENCONTRADO (404) if there is none. */
  openSessionOf(cashRegisterId: string): Promise<CashSessionDto> {
    return this.api.get(`/cajas/${cashRegisterId}/sesion-abierta`);
  }

  sessionSummary(sessionId: string): Promise<CashSessionSummaryDto> {
    return this.api.get(`/sesiones-caja/${sessionId}/resumen`);
  }

  /** Close blocked with 422 PAGO_PENDIENTE if there are unresolved payments (D-12). */
  closeSession(sessionId: string, countedAmount: number, notes: string | null, idempotencyKey = newIdempotencyKey()): Promise<CashSessionDto> {
    return this.api.post(`/sesiones-caja/${sessionId}/cierre`, { countedAmount, notes }, { idempotencyKey });
  }

  /** The withdrawal is sent with their token by the authorizing supervisor (`asToken`), with the cash.withdrawal permission. */
  registerMovement(sessionId: string, body: { kind: 'income' | 'expense'; amount: number; reasonId: string; note: string | null },
    idempotencyKey: string, asToken?: string): Promise<CashMovementDto> {
    return this.api.post(`/sesiones-caja/${sessionId}/movimientos`, body, { idempotencyKey, asToken });
  }

  movements(sessionId: string): Promise<CashMovementDto[]> {
    return this.api.get(`/sesiones-caja/${sessionId}/movimientos`);
  }

  cashReasons(): Promise<CashReasonDto[]> {
    return this.api.get('/motivos-caja');
  }

  // Ventas (fase 8)
  /** Products sellable at the branch (active, available and with a price), all pages. */
  async posProducts(branchId: string): Promise<PosProduct[]> {
    const all: PosProduct[] = [];
    for (let page = 1; ; page++) {
      const r = await this.api.get<PagedResult<ProductDto>>('/productos', { sucursalId: branchId, page, pageSize: 200 });
      for (const p of r.items) {
        if (p.isActive && p.isAvailable && p.price !== null) {
          all.push({ id: p.id, sku: p.sku, name: p.name, category: p.categoryName || 'Sin categoría', price: p.price,
            priceIncludesTax: p.priceIncludesTax ?? true, taxRate: p.taxRate, allowsDecimals: p.allowsDecimals, unitCode: p.unitCode, barcode: p.barcode });
        }
      }
      if (page * r.pageSize >= r.totalCount) return all;
    }
  }

  paymentMethods(): Promise<PaymentMethodDto[]> {
    return this.api.get('/medios-pago');
  }

  createSale(body: { cashRegisterId: string; customerIdentification: string | null; lines: SaleLineInput[] }, idempotencyKey: string): Promise<SaleDto> {
    return this.api.post('/ventas', body, { idempotencyKey });
  }

  sale(id: string): Promise<SaleDto> {
    return this.api.get(`/ventas/${id}`);
  }

  setCustomer(id: string, customerIdentification: string | null): Promise<SaleDto> {
    return this.api.put(`/ventas/${id}/cliente`, { customerIdentification });
  }

  /** Sent by the authorizing supervisor (their token): selling without stock on "block" products (D-06). */
  authorizeStock(id: string, authorizerToken: string): Promise<SaleDto> {
    return this.api.post(`/ventas/${id}/autorizar-existencias`, {}, { asToken: authorizerToken });
  }

  addPayment(id: string, body: { paymentMethodId: string; amount: number; amountTendered: number | null; reference: string | null }, idempotencyKey: string): Promise<SaleDto> {
    return this.api.post(`/ventas/${id}/pagos`, body, { idempotencyKey });
  }

  cancelSale(id: string): Promise<SaleDto> {
    return this.api.post(`/ventas/${id}/cancelar`);
  }

  sessionSales(cashSessionId: string): Promise<PagedResult<SaleListItemV2>> {
    return this.api.get('/ventas', { sesionCajaId: cashSessionId, page: 1, pageSize: 200 });
  }

  /** D-11: sent by whoever authorizes (sales.void) with their token. */
  voidSale(id: string, reason: string, authorizerToken?: string): Promise<SaleDto> {
    return this.api.post(`/ventas/${id}/anulacion`, { reason }, authorizerToken ? { asToken: authorizerToken } : {});
  }

  /** US-9.2: sent by whoever authorizes (returns.approve) with their token; the cash comes out of this register. */
  returnSale(id: string, body: { cashRegisterId: string; reason: string; lines: SaleReturnLineInput[] }, idempotencyKey: string,
    authorizerToken?: string): Promise<SaleDto> {
    return this.api.post(`/ventas/${id}/devoluciones`, body, authorizerToken ? { asToken: authorizerToken, idempotencyKey } : { idempotencyKey });
  }

  saleByNumber(number: number): Promise<PagedResult<SaleListItemV2>> {
    return this.api.get('/ventas', { numero: number, page: 1, pageSize: 1 });
  }
}
