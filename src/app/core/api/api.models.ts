/**
 * API contracts (a mirror of the DTOs of Tahona.BakeryPOS.Application).
 * The API serializes in camelCase; money travels as a decimal number.
 * What is marked "phase 2" already follows the backend API; the rest comes from the previous system and each phase adapts it.
 */

// ---- Sessions (phase 2) ----

/** POST /auth/login-pin (X-Device-Token header of the paired device). */
export interface LoginPinRequest {
  userId: string;
  pin: string;
}

/** POST /auth/login (backoffice). */
export interface LoginPasswordRequest {
  email: string;
  password: string;
}

export interface CompanySummary {
  id: string;
  name: string;
}

/** Response of login, select-company, refresh, change-password and login-pin. */
export interface AuthSessionDto {
  accessToken: string;
  expiresAt: string;
  /** Backoffice only; the cash-register session is renewed with the PIN. */
  refreshToken: string | null;
  userId: string;
  fullName: string;
  /** null = it still has to choose a company (several companies or platform administrator). */
  companyId: string | null;
  permissions: string[];
  mustChangePassword: boolean;
  isPlatformAdmin: boolean;
  companies: CompanySummary[];
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface SalesReportDto {
  from: string;
  to: string;
  salesCount: number;
  totalSold: number;
  voidedCount: number;
  totalVoided: number;
  returnsCount: number;
  totalReturned: number;
  netSold: number;
  taxTotal: number;
  days: { date: string; salesCount: number; totalSold: number; voidedCount: number; totalVoided: number; totalReturned: number }[];
  branchBreakdown: { branchId: string; branchName: string; salesCount: number; totalSold: number; voidedCount: number; totalVoided: number; totalReturned: number }[];
  paymentMethods: { paymentMethodId: string; methodName: string; approved: number; refunded: number; net: number }[];
  topProducts: { productId: string; name: string; quantity: number; total: number }[];
}

/** Error body of ResultExtensions.ToErrorResult. */
export interface ApiErrorBody {
  code?: string;
  message?: string;
  details?: Record<string, string[]> | null;
}

/**
 * Payment methods and cash reasons of the device (previous system). The API does not yet have an endpoint that delivers them:
 * they arrive with phases 3 (catalog), 5 (registers and shifts) and 6 (payments).
 */
export interface DeviceSetupDto {
  branchId: string;
  branchName: string;
  cashRegisters: { id: string; name: string }[];
  paymentMethods: { id: string; code: string; name: string; kind: 'cash' | 'card' | 'transfer' | 'wallet' | 'other'; requiresReference: boolean }[];
  defaultPriceListId: string | null;
  cashReasons: { id: string; name: string; type: 'Income' | 'Expense' }[];
}

// ---- Paired device (phase 2) ----

/** POST /device/pair. The token is only delivered in this response. */
export interface PairedDeviceDto {
  deviceId: string;
  deviceToken: string;
  companyId: string;
  branchId: string;
  cashRegisterId: string;
  cashRegisterName: string;
}

/** GET /device/users: who has a PIN and a current role at the register's branch. */
export interface DeviceUserDto {
  userId: string;
  fullName: string;
}

// ---- Backoffice (phase 2) ----

/** Master data with ETag: `version` is the value for If-Match. */
export interface Versioned {
  version: string;
}

/** GET /company */
export interface CompanyDto extends Versioned {
  id: string;
  legalName: string;
  tradeName: string | null;
  nit: string;
  nitCheckDigit: number;
  taxRegime: string;
  taxResponsibilities: string[];
  email: string;
  phone: string | null;
  address: string | null;
  cityCode: string | null;
  timeZone: string;
  currency: string;
  status: string;
}

/** PUT /company */
export interface UpdateCompanyRequest {
  tradeName: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  cityCode: string | null;
  timeZone: string | null;
}

/** GET /branches */
export interface BranchDto extends Versioned {
  id: string;
  code: string;
  name: string;
  address: string | null;
  cityCode: string | null;
  phone: string | null;
  isActive: boolean;
}

export interface CreateBranchRequest { code: string; name: string; address: string | null; cityCode: string | null; phone: string | null; }
export interface UpdateBranchRequest { name: string; address: string | null; cityCode: string | null; phone: string | null; }

/** GET /cash-registers */
export interface CashRegisterDto {
  id: string;
  branchId: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface CreateCashRegisterRequest { branchId: string; code: string; name: string; }

/** GET /devices */
export interface DeviceDto {
  id: string;
  cashRegisterId: string;
  name: string;
  isActive: boolean;
  lastSeenAt: string | null;
  createdAt: string;
}

/** POST /cash-registers/{id}/pairing-codes: 8 characters, single use, 15 minutes. */
export interface PairingCodeDto {
  code: string;
  expiresAt: string;
  cashRegisterId: string;
}

export interface AssignmentDto {
  id: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  /** null = all branches. */
  branchId: string | null;
  validFrom: string;
  validTo: string | null;
  isCurrent: boolean;
}

/** GET /users */
export interface UserDto extends Versioned {
  id: string;
  fullName: string;
  email: string | null;
  isActive: boolean;
  hasPin: boolean;
  canUseBackoffice: boolean;
  assignments: AssignmentDto[];
}

export interface AssignmentInput {
  roleId: string;
  branchId: string | null;
  validFrom?: string | null;
  validTo?: string | null;
}

/** POST /users: with an email, the user can sign in to the backoffice. */
export interface CreateUserRequest {
  fullName: string;
  email: string | null;
  pin: string | null;
  assignments: AssignmentInput[];
}

/** The one-time password only comes here and only if the user is new. */
export interface CreatedUserDto {
  user: UserDto;
  temporaryPassword: string | null;
}

/** PUT /users/{id}: `pin` null = do not change it. */
export interface UpdateUserRequest {
  fullName: string;
  isActive: boolean;
  pin: string | null;
}

/** GET /roles */
export interface RoleDto {
  id: string;
  code: string;
  name: string;
  isSystem: boolean;
  permissions: string[];
}

// ---- Platform (phase 2) ----

/** GET /platform/companies */
export interface PlatformCompanyDto {
  id: string;
  legalName: string;
  tradeName: string | null;
  nit: string;
  nitCheckDigit: number;
  status: string;
  createdAt: string;
}

/** POST /platform/companies */
export interface CreateCompanyRequest {
  legalName: string;
  tradeName: string | null;
  nit: string;
  nitCheckDigit: number;
  taxRegime: string;
  taxResponsibilities: string[];
  email: string;
  phone: string | null;
  address: string | null;
  cityCode: string | null;
  timeZone: string | null;
  owner: { fullName: string; email: string };
}

export interface CreatedCompanyDto {
  company: CompanyDto;
  /** `temporaryPassword` null = the owner already had an account and keeps their password. */
  owner: { userId: string; email: string; temporaryPassword: string | null };
}

export interface SaleListItemDto {
  id: string;
  documentNumber: string | null;
  saleDate: string;
  branchName: string;
  soldBy: string;
  total: number;
  status: 'Completed' | 'Voided' | string;
  paymentMethods: string;
}

/** GET /sales/{id} */
export interface SaleDetailDto {
  id: string;
  documentNumber: string | null;
  saleDate: string;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  status: string;
  soldBy: string;
  customerName: string | null;
  lines: { lineNumber: number; productName: string; quantity: number; unitPrice: number; discountPercent: number; taxRate: number; lineTotal: number }[];
  payments: { paymentMethodName: string; amount: number; reference: string | null }[];
}

// ---- Catalog and prices (phase 3) ----

export interface CategoryDto extends Versioned {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  productCount: number;
}

export type TaxKind = 'iva' | 'inc' | 'none';

export interface TaxDto extends Versioned {
  id: string;
  code: string;
  name: string;
  kind: TaxKind;
  /** Porcentaje: 19 = 19 %. */
  rate: number;
  dianCode: string;
  isActive: boolean;
}

export interface UnitDto {
  id: string;
  code: string;
  name: string;
  kind: 'count' | 'mass' | 'volume';
  dianCode: string;
  /** Mass and volume: the register asks for the quantity (weight) when selling. */
  allowsDecimals: boolean;
}

/** GET /products?branchId=: the price in force and availability at that branch. */
export interface ProductDto extends Versioned {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  categoryName: string;
  unitId: string;
  unitCode: string;
  allowsDecimals: boolean;
  taxId: string;
  taxName: string;
  taxRate: number;
  barcode: string | null;
  trackStock: boolean;
  /** D-06: allow = allow negative; block = block unless authorized. */
  negativeStockPolicy: NegativeStockPolicy;
  isActive: boolean;
  basePrice: number | null;
  branchPrice: number | null;
  /** The branch's if it has a current one; otherwise the base one. */
  price: number | null;
  /** D-07: list prices include the tax. */
  priceIncludesTax: boolean | null;
  isAvailable: boolean;
}

export interface ProductPriceDto {
  id: string;
  /** null = base price. */
  branchId: string | null;
  amount: number;
  includesTax: boolean;
  validFrom: string;
  validTo: string | null;
  isCurrent: boolean;
}

export interface CreateProductRequest {
  sku: string;
  name: string;
  categoryId: string;
  unitId: string;
  taxId: string;
  barcode: string | null;
  trackStock: boolean;
  negativeStockPolicy: NegativeStockPolicy;
  /** First base price, in force from now (with tax included). */
  basePrice: number | null;
}

export interface UpdateProductRequest {
  name: string;
  categoryId: string;
  unitId: string;
  taxId: string;
  barcode: string | null;
  trackStock: boolean;
  negativeStockPolicy: NegativeStockPolicy;
}

export type NegativeStockPolicy = 'allow' | 'block';

export interface SetPriceRequest {
  branchId: string | null;
  amount: number;
  includesTax: boolean;
  /** null = from now. */
  validFrom: string | null;
}

// ---- Audit (phase 3) ----

export interface AuditLogDto {
  id: string;
  occurredAt: string;
  userId: string | null;
  userName: string | null;
  /** Table with schema, e.g. cat.products. */
  entity: string;
  entityId: string;
  /** create | update | delete */
  action: string;
  oldValues: string | null;
  newValues: string | null;
}

// ---- Inventory (phase 4) ----

export interface StockLocationDto {
  id: string;
  branchId: string;
  code: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface AdjustmentReasonDto {
  id: string;
  code: string;
  name: string;
  direction: 'in' | 'out' | 'both';
  isActive: boolean;
}

/** GET /stock: each product that tracks stock per location (0 if it has no movements). */
export interface StockRowDto {
  locationId: string;
  locationName: string;
  productId: string;
  sku: string;
  productName: string;
  unitCode: string;
  onHand: number;
  allowNegative: boolean;
  hasMovements: boolean;
}

export type StockMovementKind = 'initial' | 'sale' | 'return' | 'void_reversal' | 'adjustment_in' | 'adjustment_out';

export interface StockMovementDto {
  id: string;
  occurredAt: string;
  locationId: string;
  locationName: string;
  productId: string;
  sku: string;
  productName: string;
  unitCode: string;
  /** Signed: positive goes in, negative goes out. */
  quantity: number;
  kind: StockMovementKind;
  reasonName: string | null;
  userName: string | null;
  authorizedByName: string | null;
  note: string | null;
}

export interface CountResultLine {
  productId: string;
  productName: string;
  previous: number;
  counted: number;
  difference: number;
}

export interface ReconciliationDto {
  checkedAt: string;
  balancesChecked: number;
  differences: { locationId: string; locationName: string; productId: string; productName: string; onHand: number; expected: number; difference: number }[];
}

// ---- Registers and shifts (phase 5) ----

export type CashSessionStatus = 'open' | 'closing' | 'closed';

export interface CashSessionDto {
  id: string;
  branchId: string;
  branchName: string;
  cashRegisterId: string;
  cashRegisterName: string;
  status: CashSessionStatus;
  openedAt: string;
  openedBy: string;
  openedByName: string | null;
  openingAmount: number;
  closedAt: string | null;
  closedByName: string | null;
  expectedAmount: number | null;
  countedAmount: number | null;
  /** Contado − esperado: positivo sobra, negativo falta. */
  difference: number | null;
  notes: string | null;
}

export type CashMovementKind = 'opening' | 'sale_cash' | 'change_given' | 'refund_cash' | 'income' | 'expense';

export interface CashMovementDto {
  id: string;
  occurredAt: string;
  kind: CashMovementKind;
  amount: number;
  /** Signed, for the expected amount. */
  signedAmount: number;
  reasonName: string | null;
  userName: string | null;
  authorizedByName: string | null;
  note: string | null;
}

/** GET /cash-sessions/{id}/summary: breakdown of the expected amount and payments that block the close (D-12). */
export interface CashSessionSummaryDto {
  sessionId: string;
  openingAmount: number;
  cashSales: number;
  changeGiven: number;
  cashRefunds: number;
  incomes: number;
  expenses: number;
  expected: number;
  pendingPayments: number;
}

export interface CashReasonDto {
  id: string;
  kind: 'income' | 'expense';
  name: string;
  isActive: boolean;
}

// ---- Payments (phase 6) ----

export type PaymentMethodKind = 'cash' | 'gateway' | 'external_card' | 'transfer_manual';

export interface PaymentMethodDto extends Versioned {
  id: string;
  code: string;
  name: string;
  kind: PaymentMethodKind;
  /** With gateway: POS (card), NEQUI or PAY_BY_QR_BOLD. */
  gatewayMethod: string | null;
  requiresReference: boolean;
  displayOrder: number;
  isActive: boolean;
}

/** Status of the integration per environment; it never brings the keys. */
export interface GatewayAccountDto {
  provider: string;
  environment: 'sandbox' | 'production';
  hasIdentityKey: boolean;
  hasSecretKey: boolean;
  sellerEmail: string | null;
  isActive: boolean;
  updatedAt: string | null;
}

export interface BoldTerminal {
  model: string;
  serial: string;
  status: string;
  name: string;
}

export interface BoldMethodStatus {
  name: string;
  enabled: boolean;
}

export interface RegisterTerminalDto {
  cashRegisterId: string;
  terminalModel: string;
  terminalSerial: string;
}

export interface PaymentDto {
  id: string;
  purpose: 'sale' | 'test';
  saleId: string | null;
  cashSessionId: string;
  paymentMethodId: string;
  paymentMethodName: string;
  amount: number;
  status: 'pending' | 'approved' | 'declined' | 'cancelled' | 'refunded' | 'partially_refunded';
  /** Status of the last attempt at Bold: pending, unknown, error… */
  attemptStatus: string | null;
  attemptError: string | null;
  reference: string | null;
  resolvedManually: boolean;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

// ---- Electronic invoicing with Siigo (phase 7) ----

/** It never brings the user or the access key. */
export interface FiscalSettingsDto {
  provider: string;
  hasCredentials: boolean;
  invoiceDocumentTypeId: number | null;
  creditNoteDocumentTypeId: number | null;
  sellerId: number | null;
  productAccountGroupId: number | null;
  consumerFinalIdentification: string;
  retentionYears: number;
  isComplete: boolean;
  isActive: boolean;
}

export interface SiigoCatalogItem {
  id: string;
  name: string;
  code: string | null;
  detail: string | null;
  active: boolean;
}

export interface SiigoCatalogsDto {
  invoiceTypes: SiigoCatalogItem[];
  creditNoteTypes: SiigoCatalogItem[];
  users: SiigoCatalogItem[];
  taxes: SiigoCatalogItem[];
  paymentTypes: SiigoCatalogItem[];
}

export interface FiscalMappingDto {
  kind: 'tax' | 'payment_method';
  localId: string;
  externalId: string;
}

export type FiscalDocumentStatus = 'pending' | 'submitting' | 'accepted' | 'rejected' | 'temporary_error' | 'unknown' | 'cancelled';

export interface FiscalDocumentDto {
  id: string;
  saleId: string;
  kind: 'invoice' | 'credit_note';
  status: FiscalDocumentStatus;
  prefix: string | null;
  number: number | null;
  cufe: string | null;
  total: number;
  customerIdentification: string;
  errors: string | null;
  attempts: number;
  createdAt: string;
  acceptedAt: string | null;
  retainUntil: string | null;
}

export interface FiscalAttemptDto {
  number: number;
  operation: string;
  outcome: string;
  httpStatus: number | null;
  detail: string | null;
  occurredAt: string;
}

// ---- Sales (phase 8) ----

/** Product ready to sell at the register: the price in force at the branch (with tax, D-07). */
export interface PosProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  priceIncludesTax: boolean;
  taxRate: number;
  allowsDecimals: boolean;
  unitCode: string;
  barcode: string | null;
}

export type SaleStatus = 'draft' | 'pending_payment' | 'confirmed' | 'cancelled' | 'voided';

export interface SaleLineDto {
  id: string;
  lineNo: number;
  productId: string;
  sku: string;
  description: string;
  unitCode: string;
  quantity: number;
  unitPrice: number;
  priceIncludesTax: boolean;
  discountAmount: number;
  discountReason: string | null;
  taxRate: number;
  taxableBase: number;
  taxAmount: number;
  lineTotal: number;
}

export interface SalePaymentInfo {
  id: string;
  paymentMethodId: string;
  methodName: string;
  methodKind: PaymentMethodKind;
  amount: number;
  amountTendered: number | null;
  changeAmount: number | null;
  status: 'pending' | 'approved' | 'declined' | 'cancelled' | 'refunded' | 'partially_refunded';
  attemptStatus: string | null;
  reference: string | null;
}

export interface FiscalDocumentSummary {
  id: string;
  saleId: string;
  status: FiscalDocumentStatus;
  prefix: string | null;
  number: number | null;
  cufe: string | null;
  errors: string | null;
}

export interface SaleDto {
  id: string;
  number: number | null;
  branchId: string;
  cashRegisterId: string;
  cashSessionId: string;
  cashierId: string;
  cashierName: string | null;
  customerIdentification: string | null;
  status: SaleStatus;
  paymentStatus: string;
  inventoryStatus: string;
  /** not_required | pending | accepted | rejected | in_review */
  fiscalStatus: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  /** What is still left to pay with approved payments. */
  remaining: number;
  change: number;
  stockAuthorized: boolean;
  createdAt: string;
  confirmedAt: string | null;
  lines: SaleLineDto[];
  payments: SalePaymentInfo[];
  fiscal: FiscalDocumentSummary | null;
  /** Returned to the customer through a void or returns. */
  refundedTotal: number;
  voidedAt: string | null;
  voidReason: string | null;
  voidedByName: string | null;
  /** Quantity already returned by line id. */
  returnedQuantities: Record<string, number>;
  returns: SaleReturnDto[];
  creditNotes: CreditNoteSummary[];
}

export interface SaleReturnDto {
  id: string;
  occurredAt: string;
  reason: string;
  approvedByName: string | null;
  total: number;
  lines: { saleLineId: string; description: string; quantity: number; amount: number; restock: boolean }[];
}

/** reason: 1 return, 2 void. status as in FiscalDocumentSummary. */
export interface CreditNoteSummary {
  id: string;
  saleId: string;
  sourceId: string;
  reason: number;
  status: string;
  prefix: string | null;
  number: number | null;
  cufe: string | null;
  errors: string | null;
  total: number;
}

export interface SaleReturnListItem {
  id: string;
  saleId: string;
  saleNumber: number | null;
  branchId: string;
  occurredAt: string;
  reason: string;
  approvedByName: string | null;
  total: number;
  lineCount: number;
  creditNoteStatus: string | null;
}

export interface SaleReturnLineInput {
  saleLineId: string;
  quantity: number;
  restock: boolean;
}

export interface SaleListItem {
  id: string;
  number: number | null;
  branchId: string;
  cashierName: string | null;
  customerIdentification: string | null;
  status: SaleStatus;
  paymentStatus: string;
  fiscalStatus: string;
  total: number;
  lineCount: number;
  createdAt: string;
  confirmedAt: string | null;
  refundedTotal: number;
}

export interface SaleLineInput {
  productId: string;
  quantity: number;
  discountAmount: number;
  discountReason: string | null;
}
