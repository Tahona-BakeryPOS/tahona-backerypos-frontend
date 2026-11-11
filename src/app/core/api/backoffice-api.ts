import { Injectable, inject } from '@angular/core';
import { ApiClient, newIdempotencyKey } from './api-client';
import {
  AdjustmentReasonDto, AssignmentDto, AssignmentInput, AuditLogDto, CountResultLine, ReconciliationDto, StockLocationDto,
  StockMovementDto, StockRowDto, BranchDto, CashRegisterDto, CashSessionDto, CategoryDto,
  CompanyDto, CreateBranchRequest, CreateCashRegisterRequest, CreateCompanyRequest, CreateProductRequest,
  CreateUserRequest, CreatedCompanyDto, CreatedUserDto, DeviceDto, FiscalAttemptDto, FiscalDocumentDto, FiscalMappingDto, FiscalSettingsDto, SiigoCatalogsDto, PagedResult, PairingCodeDto,
  BoldMethodStatus, BoldTerminal, GatewayAccountDto, PaymentDto, PaymentMethodDto, PaymentMethodKind, RegisterTerminalDto, PlatformCompanyDto, ProductDto, ProductPriceDto, RoleDto, SaleDto, SaleListItemV2, SaleReturnListItem, SalesReportDto,
  SetPriceRequest, TaxDto, TaxKind, UnitDto, UpdateBranchRequest, UpdateCompanyRequest, UpdateProductRequest,
  UpdateUserRequest, UserDto,
} from './api.models';

export interface DateRange {
  from: string; // yyyy-MM-dd
  to: string;
  branchId?: string | null;
}

/**
 * Backoffice gateway. API: platform, company, branches, registers, devices, users and
 * roles (phase 2); catalog, prices and audit (phase 3); inventory (phase 4); cash sessions (phase 5); payment methods, Bold and payments (phase 6); invoicing with Siigo (phase 7). PUTs send the version read in If-Match;
 * [Idempotent] POSTs carry Idempotency-Key. The rest (sales, reports) comes from the previous system and is adapted in its phase.
 */
@Injectable({ providedIn: 'root' })
export class BackofficeApi {
  private readonly api = inject(ApiClient);

  // Plataforma (D-09)
  platformCompanies(): Promise<PlatformCompanyDto[]> {
    return this.api.get('/plataforma/empresas');
  }

  /** No Idempotency-Key on purpose (I-14): the response carries the one-time password. */
  createCompany(body: CreateCompanyRequest): Promise<CreatedCompanyDto> {
    return this.api.post('/plataforma/empresas', body);
  }

  // Mi negocio
  company(): Promise<CompanyDto> {
    return this.api.get('/empresa');
  }

  updateCompany(body: UpdateCompanyRequest, version: string): Promise<CompanyDto> {
    return this.api.put('/empresa', body, { ifMatch: version });
  }

  branches(): Promise<BranchDto[]> {
    return this.api.get('/sucursales');
  }

  createBranch(body: CreateBranchRequest, idempotencyKey = newIdempotencyKey()): Promise<BranchDto> {
    return this.api.post('/sucursales', body, { idempotencyKey });
  }

  updateBranch(id: string, body: UpdateBranchRequest, version: string): Promise<BranchDto> {
    return this.api.put(`/sucursales/${id}`, body, { ifMatch: version });
  }

  deactivateBranch(id: string): Promise<BranchDto> {
    return this.api.post(`/sucursales/${id}/desactivar`);
  }

  cashRegisters(branchId?: string): Promise<CashRegisterDto[]> {
    return this.api.get('/cajas', { branchId });
  }

  createCashRegister(body: CreateCashRegisterRequest, idempotencyKey = newIdempotencyKey()): Promise<CashRegisterDto> {
    return this.api.post('/cajas', body, { idempotencyKey });
  }

  devices(): Promise<DeviceDto[]> {
    return this.api.get('/dispositivos');
  }

  createPairingCode(cashRegisterId: string): Promise<PairingCodeDto> {
    return this.api.post(`/cajas/${cashRegisterId}/codigos-vinculacion`);
  }

  deactivateDevice(id: string): Promise<DeviceDto> {
    return this.api.post(`/dispositivos/${id}/desactivar`);
  }

  // Usuarios y roles
  users(): Promise<UserDto[]> {
    return this.api.get('/usuarios');
  }

  /** No Idempotency-Key on purpose (I-14): the response may carry the one-time password. */
  createUser(body: CreateUserRequest): Promise<CreatedUserDto> {
    return this.api.post('/usuarios', body);
  }

  updateUser(id: string, body: UpdateUserRequest, version: string): Promise<UserDto> {
    return this.api.put(`/usuarios/${id}`, body, { ifMatch: version });
  }

  addAssignment(userId: string, body: AssignmentInput, idempotencyKey = newIdempotencyKey()): Promise<AssignmentDto> {
    return this.api.post(`/usuarios/${userId}/asignaciones`, body, { idempotencyKey });
  }

  /** Closes the assignment's validity; it does not delete it. */
  endAssignment(userId: string, assignmentId: string): Promise<void> {
    return this.api.delete(`/usuarios/${userId}/asignaciones/${assignmentId}`);
  }

  roles(): Promise<RoleDto[]> {
    return this.api.get('/roles');
  }

  // Catalog (phase 3)
  categories(): Promise<CategoryDto[]> {
    return this.api.get('/categorias');
  }

  createCategory(name: string, displayOrder: number, idempotencyKey = newIdempotencyKey()): Promise<CategoryDto> {
    return this.api.post('/categorias', { name, displayOrder }, { idempotencyKey });
  }

  updateCategory(c: CategoryDto, changes: { name: string; displayOrder: number; isActive: boolean }): Promise<CategoryDto> {
    return this.api.put(`/categorias/${c.id}`, changes, { ifMatch: c.version });
  }

  taxes(): Promise<TaxDto[]> {
    return this.api.get('/impuestos');
  }

  createTax(body: { code: string; name: string; kind: TaxKind; rate: number }, idempotencyKey = newIdempotencyKey()): Promise<TaxDto> {
    return this.api.post('/impuestos', body, { idempotencyKey });
  }

  updateTax(t: TaxDto, changes: { name: string; isActive: boolean }): Promise<TaxDto> {
    return this.api.put(`/impuestos/${t.id}`, changes, { ifMatch: t.version });
  }

  units(): Promise<UnitDto[]> {
    return this.api.get('/unidades');
  }

  products(q: { branchId?: string | null; search?: string; categoryId?: string | null; includeInactive?: boolean; page?: number; pageSize?: number }): Promise<PagedResult<ProductDto>> {
    return this.api.get('/productos', {
      sucursalId: q.branchId, buscar: q.search, categoriaId: q.categoryId, incluirInactivos: q.includeInactive,
      page: q.page ?? 1, pageSize: q.pageSize ?? 50,
    });
  }

  createProduct(body: CreateProductRequest, idempotencyKey = newIdempotencyKey()): Promise<ProductDto> {
    return this.api.post('/productos', body, { idempotencyKey });
  }

  updateProduct(p: ProductDto, body: UpdateProductRequest): Promise<ProductDto> {
    return this.api.put(`/productos/${p.id}`, body, { ifMatch: p.version });
  }

  setProductActive(id: string, active: boolean): Promise<ProductDto> {
    return this.api.post(`/productos/${id}/${active ? 'activar' : 'desactivar'}`);
  }

  productPrices(id: string): Promise<ProductPriceDto[]> {
    return this.api.get(`/productos/${id}/precios`);
  }

  setPrice(productId: string, body: SetPriceRequest, idempotencyKey = newIdempotencyKey()): Promise<ProductPriceDto> {
    return this.api.post(`/productos/${productId}/precios`, body, { idempotencyKey });
  }

  setAvailability(branchId: string, productId: string, isAvailable: boolean): Promise<void> {
    return this.api.put(`/sucursales/${branchId}/productos/${productId}/disponibilidad`, { isAvailable });
  }

  // Inventario (fase 4)
  stock(q: { branchId: string; locationId?: string | null; search?: string; page?: number; pageSize?: number }): Promise<PagedResult<StockRowDto>> {
    return this.api.get('/existencias', { sucursalId: q.branchId, ubicacionId: q.locationId, buscar: q.search, page: q.page ?? 1, pageSize: q.pageSize ?? 50 });
  }

  stockMovements(q: { branchId: string; locationId?: string | null; productId?: string | null; kind?: string | null; from?: string | null; to?: string | null; page: number; pageSize?: number }): Promise<PagedResult<StockMovementDto>> {
    return this.api.get('/movimientos-inventario', {
      sucursalId: q.branchId, ubicacionId: q.locationId, productoId: q.productId, tipo: q.kind, desde: q.from, hasta: q.to,
      page: q.page, pageSize: q.pageSize ?? 50,
    });
  }

  stockLocations(branchId?: string | null): Promise<StockLocationDto[]> {
    return this.api.get('/ubicaciones', { sucursalId: branchId });
  }

  createStockLocation(body: { branchId: string; code: string; name: string }, idempotencyKey = newIdempotencyKey()): Promise<StockLocationDto> {
    return this.api.post('/ubicaciones', body, { idempotencyKey });
  }

  adjustmentReasons(): Promise<AdjustmentReasonDto[]> {
    return this.api.get('/inventario/motivos');
  }

  registerInitialStock(body: { locationId: string; lines: { productId: string; quantity: number }[]; note: string | null }, idempotencyKey: string): Promise<StockMovementDto[]> {
    return this.api.post('/inventario/inicial', body, { idempotencyKey });
  }

  registerAdjustment(body: { locationId: string; productId: string; quantity: number; reasonId: string; note: string | null }, idempotencyKey: string): Promise<StockMovementDto> {
    return this.api.post('/inventario/ajustes', body, { idempotencyKey });
  }

  registerCount(body: { locationId: string; lines: { productId: string; counted: number }[]; note: string | null }, idempotencyKey: string): Promise<CountResultLine[]> {
    return this.api.post('/inventario/conteos', body, { idempotencyKey });
  }

  reconciliation(branchId?: string | null): Promise<ReconciliationDto> {
    return this.api.get('/inventario/reconciliacion', { sucursalId: branchId });
  }

  // Ventas y caja (v1, fases 5, 6 y 9)
  // Ventas (fase 8)
  salesV2(range: DateRange, status: string | null, page: number, pageSize = 50): Promise<PagedResult<SaleListItemV2>> {
    return this.api.get('/ventas', {
      desde: new Date(`${range.from}T00:00:00`).toISOString(), hasta: new Date(`${range.to}T23:59:59.999`).toISOString(),
      sucursalId: range.branchId, estado: status, page, pageSize,
    });
  }

  saleV2(id: string): Promise<SaleDto> {
    return this.api.get(`/ventas/${id}`);
  }

  // Devoluciones e informes (fase 9)
  saleReturns(range: DateRange, page: number, pageSize = 50): Promise<PagedResult<SaleReturnListItem>> {
    return this.api.get('/devoluciones', {
      desde: new Date(`${range.from}T00:00:00`).toISOString(), hasta: new Date(`${range.to}T23:59:59.999`).toISOString(),
      sucursalId: range.branchId, page, pageSize,
    });
  }

  /** Colombian days (yyyy-MM-dd), inclusive. */
  salesReport(range: DateRange): Promise<SalesReportDto> {
    return this.api.get('/informes/ventas', { desde: range.from, hasta: range.to, sucursalId: range.branchId });
  }

  /** Cash sessions open in the range (whole days in local time). */
  cashSessions(range: DateRange, status: 'open' | 'closed' | null): Promise<CashSessionDto[]> {
    return this.api.get('/sesiones-caja', {
      desde: new Date(`${range.from}T00:00:00`).toISOString(), hasta: new Date(`${range.to}T23:59:59.999`).toISOString(),
      sucursalId: range.branchId, estado: status,
    });
  }

  // Pagos (fase 6)
  paymentMethods(): Promise<PaymentMethodDto[]> {
    return this.api.get('/medios-pago');
  }

  createPaymentMethod(body: { code: string; name: string; kind: PaymentMethodKind; gatewayMethod: string | null; requiresReference: boolean; displayOrder: number },
    idempotencyKey = newIdempotencyKey()): Promise<PaymentMethodDto> {
    return this.api.post('/medios-pago', body, { idempotencyKey });
  }

  updatePaymentMethod(m: PaymentMethodDto, changes: { name: string; requiresReference: boolean; displayOrder: number; isActive: boolean }): Promise<PaymentMethodDto> {
    return this.api.put(`/medios-pago/${m.id}`, changes, { ifMatch: m.version });
  }

  gatewayAccounts(): Promise<GatewayAccountDto[]> {
    return this.api.get('/integraciones/pasarela');
  }

  /** Null keys = keep the stored ones. They are never returned. */
  saveGatewayAccount(body: { environment: 'sandbox' | 'production'; identityKey: string | null; secretKey: string | null; sellerEmail: string; activate: boolean }): Promise<GatewayAccountDto> {
    return this.api.put('/integraciones/pasarela', body);
  }

  boldTerminals(): Promise<BoldTerminal[]> {
    return this.api.get('/integraciones/pasarela/datafonos');
  }

  boldMethods(): Promise<BoldMethodStatus[]> {
    return this.api.get('/integraciones/pasarela/metodos');
  }

  registerTerminals(): Promise<RegisterTerminalDto[]> {
    return this.api.get('/integraciones/pasarela/cajas');
  }

  setRegisterTerminal(cashRegisterId: string, terminalModel: string, terminalSerial: string): Promise<RegisterTerminalDto> {
    return this.api.put(`/cajas/${cashRegisterId}/datafono`, { terminalModel, terminalSerial });
  }

  testCharge(body: { cashRegisterId: string; paymentMethodId: string; amount: number }, idempotencyKey: string): Promise<PaymentDto> {
    return this.api.post('/integraciones/pasarela/prueba', body, { idempotencyKey });
  }

  payment(id: string): Promise<PaymentDto> {
    return this.api.get(`/pagos/${id}`);
  }

  payments(range: DateRange, status: string | null): Promise<PaymentDto[]> {
    return this.api.get('/pagos', {
      desde: new Date(`${range.from}T00:00:00`).toISOString(), hasta: new Date(`${range.to}T23:59:59.999`).toISOString(), estado: status,
    });
  }

  resolvePayment(id: string, body: { resolution: 'approved' | 'declined' | 'cancelled'; approvalNumber: string | null; note: string }): Promise<PaymentDto> {
    return this.api.post(`/pagos/${id}/resolver`, body);
  }

  // Electronic invoicing with Siigo (phase 7)
  fiscalSettings(): Promise<FiscalSettingsDto> {
    return this.api.get('/facturacion/configuracion');
  }

  /** A null user and key = keep the stored ones. They are never returned. */
  saveFiscalSettings(body: {
    username: string | null; accessKey: string | null; invoiceDocumentTypeId: number | null; creditNoteDocumentTypeId: number | null;
    sellerId: number | null; productAccountGroupId: number | null; consumerFinalIdentification: string; retentionYears: number; activate: boolean;
  }): Promise<FiscalSettingsDto> {
    return this.api.put('/facturacion/configuracion', body);
  }

  siigoCatalogs(): Promise<SiigoCatalogsDto> {
    return this.api.get('/facturacion/siigo/catalogos');
  }

  fiscalMappings(): Promise<FiscalMappingDto[]> {
    return this.api.get('/facturacion/mapeos');
  }

  saveFiscalMappings(mappings: FiscalMappingDto[]): Promise<FiscalMappingDto[]> {
    return this.api.put('/facturacion/mapeos', { mappings });
  }

  testInvoice(body: { productId: string; quantity: number; paymentMethodId: string; confirmTestEnvironment: boolean }, idempotencyKey: string): Promise<FiscalDocumentDto> {
    return this.api.post('/facturacion/prueba', body, { idempotencyKey });
  }

  fiscalDocuments(range: DateRange, status: string | null): Promise<FiscalDocumentDto[]> {
    return this.api.get('/documentos-fiscales', {
      desde: new Date(`${range.from}T00:00:00`).toISOString(), hasta: new Date(`${range.to}T23:59:59.999`).toISOString(), estado: status,
    });
  }

  fiscalAttempts(id: string): Promise<FiscalAttemptDto[]> {
    return this.api.get(`/documentos-fiscales/${id}/intentos`);
  }

  fiscalDocumentPdf(id: string): Promise<Blob> {
    return this.api.getBlob(`/documentos-fiscales/${id}/pdf`);
  }

  retryFiscalDocument(id: string): Promise<FiscalDocumentDto> {
    return this.api.post(`/documentos-fiscales/${id}/reintentar`);
  }

  // Audit (phase 3)
  auditLog(q: { entity?: string | null; from?: string | null; to?: string | null; page: number; pageSize?: number }): Promise<PagedResult<AuditLogDto>> {
    return this.api.get('/auditoria', { entidad: q.entity, desde: q.from, hasta: q.to, page: q.page, pageSize: q.pageSize ?? 50 });
  }

  auditEntities(): Promise<string[]> {
    return this.api.get('/auditoria/entidades');
  }
}
