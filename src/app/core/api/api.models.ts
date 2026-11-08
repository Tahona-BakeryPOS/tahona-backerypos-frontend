/**
 * Contratos de la API (espejo de los DTO de BakeryPOS.Application).
 * La API serializa en camelCase; el dinero viaja como número decimal.
 * Lo marcado "fase 2" ya sigue el backend v2; el resto es de la v1 y cada fase lo adapta.
 */

// ---- Sesiones (fase 2) ----

/** POST /auth/login-pin (encabezado X-Device-Token del equipo vinculado). */
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

/** Respuesta de login, select-company, refresh, cambiar-contrasena y login-pin. */
export interface AuthSessionDto {
  accessToken: string;
  expiresAt: string;
  /** Solo backoffice; la sesión de caja se renueva con el PIN. */
  refreshToken: string | null;
  userId: string;
  fullName: string;
  /** null = aún debe elegir empresa (varias empresas o administrador de plataforma). */
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

/** Cuerpo de error de ResultExtensions.ToErrorResult. */
export interface ApiErrorBody {
  codigo?: string;
  mensaje?: string;
  detalles?: Record<string, string[]> | null;
}

/**
 * Medios de pago y motivos de caja del equipo (v1). La v2 aún no tiene endpoint que los entregue:
 * llegan con las fases 3 (catálogo), 5 (cajas y turnos) y 6 (pagos).
 */
export interface DeviceSetupDto {
  branchId: string;
  branchName: string;
  cashRegisters: { id: string; name: string }[];
  paymentMethods: { id: string; code: string; name: string; kind: 'cash' | 'card' | 'transfer' | 'wallet' | 'other'; requiresReference: boolean }[];
  defaultPriceListId: string | null;
  cashReasons: { id: string; name: string; type: 'Income' | 'Expense' }[];
}

// ---- Dispositivo vinculado (fase 2) ----

/** POST /dispositivo/vincular. El token solo se entrega en esta respuesta. */
export interface PairedDeviceDto {
  deviceId: string;
  deviceToken: string;
  companyId: string;
  branchId: string;
  cashRegisterId: string;
  cashRegisterName: string;
}

/** GET /dispositivo/usuarios: quién tiene PIN y rol vigente en la sucursal de la caja. */
export interface DeviceUserDto {
  userId: string;
  fullName: string;
}

// ---- Backoffice (fase 2) ----

/** Datos maestros con ETag: `version` es el valor para If-Match. */
export interface Versioned {
  version: string;
}

/** GET /empresa */
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

/** PUT /empresa */
export interface UpdateCompanyRequest {
  tradeName: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  cityCode: string | null;
  timeZone: string | null;
}

/** GET /sucursales */
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

/** GET /cajas */
export interface CashRegisterDto {
  id: string;
  branchId: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface CreateCashRegisterRequest { branchId: string; code: string; name: string; }

/** GET /dispositivos */
export interface DeviceDto {
  id: string;
  cashRegisterId: string;
  name: string;
  isActive: boolean;
  lastSeenAt: string | null;
  createdAt: string;
}

/** POST /cajas/{id}/codigos-vinculacion: 8 caracteres, un solo uso, 15 minutos. */
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
  /** null = todas las sucursales. */
  branchId: string | null;
  validFrom: string;
  validTo: string | null;
  isCurrent: boolean;
}

/** GET /usuarios */
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

/** POST /usuarios: con correo, el usuario puede entrar al backoffice. */
export interface CreateUserRequest {
  fullName: string;
  email: string | null;
  pin: string | null;
  assignments: AssignmentInput[];
}

/** La contraseña de un solo uso solo viene aquí y solo si el usuario es nuevo. */
export interface CreatedUserDto {
  user: UserDto;
  temporaryPassword: string | null;
}

/** PUT /usuarios/{id}: `pin` null = no cambiarlo. */
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

// ---- Plataforma (fase 2) ----

/** GET /plataforma/empresas */
export interface PlatformCompanyDto {
  id: string;
  legalName: string;
  tradeName: string | null;
  nit: string;
  nitCheckDigit: number;
  status: string;
  createdAt: string;
}

/** POST /plataforma/empresas */
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
  /** `temporaryPassword` null = el propietario ya tenía cuenta y conserva su contraseña. */
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

// ---- Catálogo y precios (fase 3) ----

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
  /** Masa y volumen: la caja pide la cantidad (peso) al vender. */
  allowsDecimals: boolean;
}

/** GET /productos?sucursalId=: precio que rige y disponibilidad en esa sucursal. */
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
  /** D-06: allow = permitir negativo; block = bloquear salvo autorización. */
  negativeStockPolicy: NegativeStockPolicy;
  isActive: boolean;
  basePrice: number | null;
  branchPrice: number | null;
  /** El de la sucursal si tiene uno vigente; si no, el base. */
  price: number | null;
  /** D-07: los precios de lista incluyen el impuesto. */
  priceIncludesTax: boolean | null;
  isAvailable: boolean;
}

export interface ProductPriceDto {
  id: string;
  /** null = precio base. */
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
  /** Primer precio base, vigente desde ya (con impuesto incluido). */
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
  /** null = desde ahora. */
  validFrom: string | null;
}

// ---- Auditoría (fase 3) ----

export interface AuditLogDto {
  id: string;
  occurredAt: string;
  userId: string | null;
  userName: string | null;
  /** Tabla con esquema, p. ej. cat.products. */
  entity: string;
  entityId: string;
  /** creacion | modificacion | eliminacion */
  action: string;
  oldValues: string | null;
  newValues: string | null;
}

// ---- Inventario (fase 4) ----

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

/** GET /existencias: cada producto que controla existencias por ubicación (0 si no tiene movimientos). */
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
  /** Con signo: positivo entra, negativo sale. */
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

// ---- Cajas y turnos (fase 5) ----

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
  /** Con signo para el esperado. */
  signedAmount: number;
  reasonName: string | null;
  userName: string | null;
  authorizedByName: string | null;
  note: string | null;
}

/** GET /sesiones-caja/{id}/resumen: desglose del esperado y pagos que bloquean el cierre (D-12). */
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

// ---- Pagos (fase 6) ----

export type PaymentMethodKind = 'cash' | 'gateway' | 'external_card' | 'transfer_manual';

export interface PaymentMethodDto extends Versioned {
  id: string;
  code: string;
  name: string;
  kind: PaymentMethodKind;
  /** Con gateway: POS (tarjeta), NEQUI o PAY_BY_QR_BOLD. */
  gatewayMethod: string | null;
  requiresReference: boolean;
  displayOrder: number;
  isActive: boolean;
}

/** Estado de la integración por ambiente; nunca trae las llaves. */
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
  /** Estado del último intento en Bold: pending, unknown, error… */
  attemptStatus: string | null;
  attemptError: string | null;
  reference: string | null;
  resolvedManually: boolean;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

// ---- Facturación electrónica con Siigo (fase 7) ----

/** Nunca trae el usuario ni la llave de acceso. */
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

// ---- Ventas (fase 8) ----

/** Producto listo para vender en la caja: precio que rige en la sucursal (con impuesto, D-07). */
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
  /** Lo que falta por pagar con pagos aprobados. */
  remaining: number;
  change: number;
  stockAuthorized: boolean;
  createdAt: string;
  confirmedAt: string | null;
  lines: SaleLineDto[];
  payments: SalePaymentInfo[];
  fiscal: FiscalDocumentSummary | null;
  /** Devuelto al cliente por anulación o devoluciones. */
  refundedTotal: number;
  voidedAt: string | null;
  voidReason: string | null;
  voidedByName: string | null;
  /** Cantidad ya devuelta por id de línea. */
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

/** reason: 1 devolución, 2 anulación. status como FiscalDocumentSummary. */
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

export interface SaleListItemV2 {
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
