import { Injectable, inject } from '@angular/core';
import { ApiClient, newIdempotencyKey } from './api-client';
import {
  AdjustmentReasonDto, AssignmentDto, AssignmentInput, AuditLogDto, CountResultLine, ReconciliationDto, StockLocationDto,
  StockMovementDto, StockRowDto, BranchDto, CashRegisterDto, CashSessionDto, CategoryDto,
  CompanyDto, CreateBranchRequest, CreateCashRegisterRequest, CreateCompanyRequest, CreateProductRequest,
  CreateUserRequest, CreatedCompanyDto, CreatedUserDto, DeviceDto, FiscalAttemptDto, FiscalDocumentDto, FiscalMappingDto, FiscalSettingsDto, SiigoCatalogsDto, PagedResult, PairingCodeDto,
  BoldMethodStatus, BoldTerminal, GatewayAccountDto, PaymentDto, PaymentMethodDto, PaymentMethodKind, RegisterTerminalDto, PlatformCompanyDto, ProductDto, ProductPriceDto, RoleDto, SaleDto, SaleListItem, SaleReturnListItem, SalesReportDto,
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
    return this.api.get('/platform/companies');
  }

  /** No Idempotency-Key on purpose (I-14): the response carries the one-time password. */
  createCompany(body: CreateCompanyRequest): Promise<CreatedCompanyDto> {
    return this.api.post('/platform/companies', body);
  }

  // My business
  company(): Promise<CompanyDto> {
    return this.api.get('/company');
  }

  updateCompany(body: UpdateCompanyRequest, version: string): Promise<CompanyDto> {
    return this.api.put('/company', body, { ifMatch: version });
  }

  branches(): Promise<BranchDto[]> {
    return this.api.get('/branches');
  }

  createBranch(body: CreateBranchRequest, idempotencyKey = newIdempotencyKey()): Promise<BranchDto> {
    return this.api.post('/branches', body, { idempotencyKey });
  }

  updateBranch(id: string, body: UpdateBranchRequest, version: string): Promise<BranchDto> {
    return this.api.put(`/branches/${id}`, body, { ifMatch: version });
  }

  deactivateBranch(id: string): Promise<BranchDto> {
    return this.api.post(`/branches/${id}/deactivate`);
  }

  cashRegisters(branchId?: string): Promise<CashRegisterDto[]> {
    return this.api.get('/cash-registers', { branchId });
  }

  createCashRegister(body: CreateCashRegisterRequest, idempotencyKey = newIdempotencyKey()): Promise<CashRegisterDto> {
    return this.api.post('/cash-registers', body, { idempotencyKey });
  }

  devices(): Promise<DeviceDto[]> {
    return this.api.get('/devices');
  }

  createPairingCode(cashRegisterId: string): Promise<PairingCodeDto> {
    return this.api.post(`/cash-registers/${cashRegisterId}/pairing-codes`);
  }

  deactivateDevice(id: string): Promise<DeviceDto> {
    return this.api.post(`/devices/${id}/deactivate`);
  }

  // Users and roles
  users(): Promise<UserDto[]> {
    return this.api.get('/users');
  }

  /** No Idempotency-Key on purpose (I-14): the response may carry the one-time password. */
  createUser(body: CreateUserRequest): Promise<CreatedUserDto> {
    return this.api.post('/users', body);
  }

  updateUser(id: string, body: UpdateUserRequest, version: string): Promise<UserDto> {
    return this.api.put(`/users/${id}`, body, { ifMatch: version });
  }

  addAssignment(userId: string, body: AssignmentInput, idempotencyKey = newIdempotencyKey()): Promise<AssignmentDto> {
    return this.api.post(`/users/${userId}/assignments`, body, { idempotencyKey });
  }

  /** Closes the assignment's validity; it does not delete it. */
  endAssignment(userId: string, assignmentId: string): Promise<void> {
    return this.api.delete(`/users/${userId}/assignments/${assignmentId}`);
  }

  roles(): Promise<RoleDto[]> {
    return this.api.get('/roles');
  }

  // Catalog (phase 3)
  categories(): Promise<CategoryDto[]> {
    return this.api.get('/categories');
  }

  createCategory(name: string, displayOrder: number, idempotencyKey = newIdempotencyKey()): Promise<CategoryDto> {
    return this.api.post('/categories', { name, displayOrder }, { idempotencyKey });
  }

  updateCategory(c: CategoryDto, changes: { name: string; displayOrder: number; isActive: boolean }): Promise<CategoryDto> {
    return this.api.put(`/categories/${c.id}`, changes, { ifMatch: c.version });
  }

  taxes(): Promise<TaxDto[]> {
    return this.api.get('/taxes');
  }

  createTax(body: { code: string; name: string; kind: TaxKind; rate: number }, idempotencyKey = newIdempotencyKey()): Promise<TaxDto> {
    return this.api.post('/taxes', body, { idempotencyKey });
  }

  updateTax(t: TaxDto, changes: { name: string; isActive: boolean }): Promise<TaxDto> {
    return this.api.put(`/taxes/${t.id}`, changes, { ifMatch: t.version });
  }

  units(): Promise<UnitDto[]> {
    return this.api.get('/units');
  }

  products(q: { branchId?: string | null; search?: string; categoryId?: string | null; includeInactive?: boolean; page?: number; pageSize?: number }): Promise<PagedResult<ProductDto>> {
    return this.api.get('/products', {
      branchId: q.branchId, search: q.search, categoryId: q.categoryId, includeInactive: q.includeInactive,
      page: q.page ?? 1, pageSize: q.pageSize ?? 50,
    });
  }

  createProduct(body: CreateProductRequest, idempotencyKey = newIdempotencyKey()): Promise<ProductDto> {
    return this.api.post('/products', body, { idempotencyKey });
  }

  updateProduct(p: ProductDto, body: UpdateProductRequest): Promise<ProductDto> {
    return this.api.put(`/products/${p.id}`, body, { ifMatch: p.version });
  }

  setProductActive(id: string, active: boolean): Promise<ProductDto> {
    return this.api.post(`/products/${id}/${active ? 'activar' : 'desactivar'}`);
  }

  productPrices(id: string): Promise<ProductPriceDto[]> {
    return this.api.get(`/products/${id}/prices`);
  }

  setPrice(productId: string, body: SetPriceRequest, idempotencyKey = newIdempotencyKey()): Promise<ProductPriceDto> {
    return this.api.post(`/products/${productId}/prices`, body, { idempotencyKey });
  }

  setAvailability(branchId: string, productId: string, isAvailable: boolean): Promise<void> {
    return this.api.put(`/branches/${branchId}/products/${productId}/availability`, { isAvailable });
  }

  // Inventory (phase 4)
  stock(q: { branchId: string; locationId?: string | null; search?: string; page?: number; pageSize?: number }): Promise<PagedResult<StockRowDto>> {
    return this.api.get('/stock', { branchId: q.branchId, locationId: q.locationId, search: q.search, page: q.page ?? 1, pageSize: q.pageSize ?? 50 });
  }

  stockMovements(q: { branchId: string; locationId?: string | null; productId?: string | null; kind?: string | null; from?: string | null; to?: string | null; page: number; pageSize?: number }): Promise<PagedResult<StockMovementDto>> {
    return this.api.get('/inventory-movements', {
      branchId: q.branchId, locationId: q.locationId, productId: q.productId, type: q.kind, from: q.from, to: q.to,
      page: q.page, pageSize: q.pageSize ?? 50,
    });
  }

  stockLocations(branchId?: string | null): Promise<StockLocationDto[]> {
    return this.api.get('/locations', { branchId: branchId });
  }

  createStockLocation(body: { branchId: string; code: string; name: string }, idempotencyKey = newIdempotencyKey()): Promise<StockLocationDto> {
    return this.api.post('/locations', body, { idempotencyKey });
  }

  adjustmentReasons(): Promise<AdjustmentReasonDto[]> {
    return this.api.get('/inventory/reasons');
  }

  registerInitialStock(body: { locationId: string; lines: { productId: string; quantity: number }[]; note: string | null }, idempotencyKey: string): Promise<StockMovementDto[]> {
    return this.api.post('/inventory/initial', body, { idempotencyKey });
  }

  registerAdjustment(body: { locationId: string; productId: string; quantity: number; reasonId: string; note: string | null }, idempotencyKey: string): Promise<StockMovementDto> {
    return this.api.post('/inventory/adjustments', body, { idempotencyKey });
  }

  registerCount(body: { locationId: string; lines: { productId: string; counted: number }[]; note: string | null }, idempotencyKey: string): Promise<CountResultLine[]> {
    return this.api.post('/inventory/counts', body, { idempotencyKey });
  }

  reconciliation(branchId?: string | null): Promise<ReconciliationDto> {
    return this.api.get('/inventory/reconciliation', { branchId: branchId });
  }

  // Sales and cash (phases 5, 6 and 9)
  // Sales (phase 8)
  listSales(range: DateRange, status: string | null, page: number, pageSize = 50): Promise<PagedResult<SaleListItem>> {
    return this.api.get('/sales', {
      from: new Date(`${range.from}T00:00:00`).toISOString(), to: new Date(`${range.to}T23:59:59.999`).toISOString(),
      branchId: range.branchId, status: status, page, pageSize,
    });
  }

  getSale(id: string): Promise<SaleDto> {
    return this.api.get(`/sales/${id}`);
  }

  // Returns and reports (phase 9)
  saleReturns(range: DateRange, page: number, pageSize = 50): Promise<PagedResult<SaleReturnListItem>> {
    return this.api.get('/returns', {
      from: new Date(`${range.from}T00:00:00`).toISOString(), to: new Date(`${range.to}T23:59:59.999`).toISOString(),
      branchId: range.branchId, page, pageSize,
    });
  }

  /** Colombian days (yyyy-MM-dd), inclusive. */
  salesReport(range: DateRange): Promise<SalesReportDto> {
    return this.api.get('/reports/sales', { from: range.from, to: range.to, branchId: range.branchId });
  }

  /** Cash sessions open in the range (whole days in local time). */
  cashSessions(range: DateRange, status: 'open' | 'closed' | null): Promise<CashSessionDto[]> {
    return this.api.get('/cash-sessions', {
      from: new Date(`${range.from}T00:00:00`).toISOString(), to: new Date(`${range.to}T23:59:59.999`).toISOString(),
      branchId: range.branchId, status: status,
    });
  }

  // Payments (phase 6)
  paymentMethods(): Promise<PaymentMethodDto[]> {
    return this.api.get('/payment-methods');
  }

  createPaymentMethod(body: { code: string; name: string; kind: PaymentMethodKind; gatewayMethod: string | null; requiresReference: boolean; displayOrder: number },
    idempotencyKey = newIdempotencyKey()): Promise<PaymentMethodDto> {
    return this.api.post('/payment-methods', body, { idempotencyKey });
  }

  updatePaymentMethod(m: PaymentMethodDto, changes: { name: string; requiresReference: boolean; displayOrder: number; isActive: boolean }): Promise<PaymentMethodDto> {
    return this.api.put(`/payment-methods/${m.id}`, changes, { ifMatch: m.version });
  }

  gatewayAccounts(): Promise<GatewayAccountDto[]> {
    return this.api.get('/integrations/gateway');
  }

  /** Null keys = keep the stored ones. They are never returned. */
  saveGatewayAccount(body: { environment: 'sandbox' | 'production'; identityKey: string | null; secretKey: string | null; sellerEmail: string; activate: boolean }): Promise<GatewayAccountDto> {
    return this.api.put('/integrations/gateway', body);
  }

  boldTerminals(): Promise<BoldTerminal[]> {
    return this.api.get('/integrations/gateway/terminals');
  }

  boldMethods(): Promise<BoldMethodStatus[]> {
    return this.api.get('/integrations/gateway/methods');
  }

  registerTerminals(): Promise<RegisterTerminalDto[]> {
    return this.api.get('/integrations/gateway/cash-registers');
  }

  setRegisterTerminal(cashRegisterId: string, terminalModel: string, terminalSerial: string): Promise<RegisterTerminalDto> {
    return this.api.put(`/cash-registers/${cashRegisterId}/terminal`, { terminalModel, terminalSerial });
  }

  testCharge(body: { cashRegisterId: string; paymentMethodId: string; amount: number }, idempotencyKey: string): Promise<PaymentDto> {
    return this.api.post('/integrations/gateway/test', body, { idempotencyKey });
  }

  payment(id: string): Promise<PaymentDto> {
    return this.api.get(`/payments/${id}`);
  }

  payments(range: DateRange, status: string | null): Promise<PaymentDto[]> {
    return this.api.get('/payments', {
      from: new Date(`${range.from}T00:00:00`).toISOString(), to: new Date(`${range.to}T23:59:59.999`).toISOString(), status: status,
    });
  }

  resolvePayment(id: string, body: { resolution: 'approved' | 'declined' | 'cancelled'; approvalNumber: string | null; note: string }): Promise<PaymentDto> {
    return this.api.post(`/payments/${id}/resolve`, body);
  }

  // Electronic invoicing with Siigo (phase 7)
  fiscalSettings(): Promise<FiscalSettingsDto> {
    return this.api.get('/invoicing/settings');
  }

  /** A null user and key = keep the stored ones. They are never returned. */
  saveFiscalSettings(body: {
    username: string | null; accessKey: string | null; invoiceDocumentTypeId: number | null; creditNoteDocumentTypeId: number | null;
    sellerId: number | null; productAccountGroupId: number | null; consumerFinalIdentification: string; retentionYears: number; activate: boolean;
  }): Promise<FiscalSettingsDto> {
    return this.api.put('/invoicing/settings', body);
  }

  siigoCatalogs(): Promise<SiigoCatalogsDto> {
    return this.api.get('/invoicing/siigo/catalogs');
  }

  fiscalMappings(): Promise<FiscalMappingDto[]> {
    return this.api.get('/invoicing/mappings');
  }

  saveFiscalMappings(mappings: FiscalMappingDto[]): Promise<FiscalMappingDto[]> {
    return this.api.put('/invoicing/mappings', { mappings });
  }

  testInvoice(body: { productId: string; quantity: number; paymentMethodId: string; confirmTestEnvironment: boolean }, idempotencyKey: string): Promise<FiscalDocumentDto> {
    return this.api.post('/invoicing/test', body, { idempotencyKey });
  }

  fiscalDocuments(range: DateRange, status: string | null): Promise<FiscalDocumentDto[]> {
    return this.api.get('/fiscal-documents', {
      from: new Date(`${range.from}T00:00:00`).toISOString(), to: new Date(`${range.to}T23:59:59.999`).toISOString(), status: status,
    });
  }

  fiscalAttempts(id: string): Promise<FiscalAttemptDto[]> {
    return this.api.get(`/fiscal-documents/${id}/attempts`);
  }

  fiscalDocumentPdf(id: string): Promise<Blob> {
    return this.api.getBlob(`/fiscal-documents/${id}/pdf`);
  }

  retryFiscalDocument(id: string): Promise<FiscalDocumentDto> {
    return this.api.post(`/fiscal-documents/${id}/retry`);
  }

  // Audit (phase 3)
  auditLog(q: { entity?: string | null; from?: string | null; to?: string | null; page: number; pageSize?: number }): Promise<PagedResult<AuditLogDto>> {
    return this.api.get('/audit', { entity: q.entity, from: q.from, to: q.to, page: q.page, pageSize: q.pageSize ?? 50 });
  }

  auditEntities(): Promise<string[]> {
    return this.api.get('/audit/entities');
  }
}
