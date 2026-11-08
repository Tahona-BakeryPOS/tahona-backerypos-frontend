import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { newIdempotencyKey } from '../../../core/api/api-client';
import { PaymentMethodDto, SaleDto } from '../../../core/api/api.models';
import { ApiError, toApiError } from '../../../core/api/api-error';
import { PosApi } from '../../../core/api/pos-api';
import { Perm } from '../../../core/auth/permissions';
import { DeviceConfigStore } from '../../../core/device/device-config.store';
import { round2 } from '../../../core/domain/sale-math';
import { CartStore, discountAmount } from '../../../core/sales/cart.store';
import { CopPipe } from '../../../shared/cop.pipe';
import { ModalComponent } from '../../../shared/modal.component';
import { OwnerAuthComponent } from '../../../shared/owner-auth.component';

const KIND_ICON: Record<string, string> = { cash: '💵', gateway: '📲', external_card: '💳', transfer_manual: '🏦' };
const GATEWAY_ICON: Record<string, string> = { POS: '💳', NEQUI: '📱', PAY_BY_QR_BOLD: '🔳' };
const BILLS = [2000, 5000, 10000, 20000, 50000, 100000];
/** Consulta del estado mientras el datáfono procesa. */
const POLL_MS = 2500;

/**
 * HU-6.4 / HU-6.5: cobro en línea. Al abrir, el servidor crea la venta con sus precios (borrador). Cada pago se
 * registra en el servidor: efectivo (con cambio), transferencia o datáfono externo quedan aprobados al instante;
 * Bold envía el cobro al datáfono y aquí se ve el estado en vivo. La venta se confirma solo cuando el backend
 * aprueba todos los pagos; el frontend nunca marca un pago como aprobado.
 */
@Component({
  selector: 'app-payment-dialog',
  imports: [FormsModule, CopPipe, ModalComponent, OwnerAuthComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .methods { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; }
    .methods button { min-height: 64px; line-height: 1.2; }
    .methods button.active { border-color: var(--brand); outline: 2px solid var(--brand); }
    .waiting { text-align: center; padding: 16px; border: 2px dashed var(--brand); border-radius: 14px; margin: 10px 0; }
  `,
  template: `
    <app-modal [title]="sale() ? 'Cobrar ' + (sale()!.total | cop) : 'Preparando la venta…'" eyebrow="Cobrar" (closed)="close()">
      @if (!sale()) {
        @if (error()) {
          <p class="err" role="alert">{{ error() }}</p>
          <div class="actions"><button type="button" (click)="closed.emit()">Volver</button>
            <button type="button" class="primary" (click)="start()" [disabled]="busy()">Reintentar</button></div>
        } @else { <p class="muted">Calculando precios en el servidor…</p> }
      } @else {
        @let s = sale()!;
        @if (s.total !== previewTotal()) {
          <p class="small warn">El total del servidor ({{ s.total | cop }}) difiere de la vista previa ({{ previewTotal() | cop }}): se cobra el del servidor.</p>
        }

        @if (pending(); as p) {
          <div class="waiting" aria-live="polite">
            <b>Esperando el datáfono…</b><br />
            <span class="small">{{ p.methodName }} · {{ p.amount | cop }}. El cliente completa el pago en el datáfono.</span>
          </div>
          <p class="small muted">Si el datáfono ya mostró el resultado y aquí no cambia, un superior puede resolverlo en el backoffice (Pagos).</p>
        } @else if (needsStockAuth()) {
          <p class="warn small">{{ error() }}</p>
          <app-owner-auth [permission]="stockPerm" (authorized)="authorizeStock($event)" />
        } @else {
          <div class="methods" role="radiogroup" aria-label="Medio de pago">
            @for (m of methods(); track m.id) {
              <button type="button" role="radio" [attr.aria-checked]="method()?.id === m.id" [class.active]="method()?.id === m.id" [attr.aria-label]="m.name" (click)="select(m)">
                {{ icon(m) }}<br /><span class="small">{{ m.name }}</span>
              </button>
            }
          </div>

          @if (method(); as m) {
            <div class="two">
              <div class="field"><label for="amt">Monto a pagar con {{ m.name }}</label>
                <input id="amt" type="number" inputmode="numeric" min="0" [ngModel]="amount" (ngModelChange)="amount = $event; renewKey()" /></div>
              @if (m.kind === 'cash') {
                <div class="field"><label for="tendered">Recibido</label>
                  <input id="tendered" type="number" inputmode="numeric" min="0" [ngModel]="tendered" (ngModelChange)="tendered = $event; renewKey()" (keyup.enter)="pay()" /></div>
              }
            </div>
            @if (m.kind === 'cash') {
              <div class="quick">
                <button type="button" (click)="tendered = amount; renewKey()">Exacto</button>
                @for (b of bills(); track b) { <button type="button" (click)="tendered = b; renewKey()">{{ b | cop }}</button> }
              </div>
              @if (change() > 0) { <div class="sum-row"><b>Cambio</b><b class="ok">{{ change() | cop }}</b></div> }
            }
            @if (m.requiresReference) {
              <div class="field"><label for="ref">Referencia (obligatoria)</label><input id="ref" [ngModel]="reference" (ngModelChange)="reference = $event; renewKey()" autocomplete="off" /></div>
            }
          }
        }

        <div style="margin-top:10px">
          @for (p of s.payments; track p.id) {
            <div class="sum-row">
              <span>{{ p.methodName }}@if (p.reference) { · {{ p.reference }} }</span>
              <span>{{ p.amount | cop }} <span class="badge" [class.ok]="p.status === 'approved'" [class.warn]="p.status === 'pending'" [class.err]="p.status === 'declined' || p.status === 'cancelled'">{{ statusLabel(p.status) }}</span></span>
            </div>
          }
          <div class="sum-row"><b>Falta por pagar</b><b [class.err]="s.remaining > 0">{{ s.remaining | cop }}</b></div>
        </div>

        <p class="err small" role="alert" style="min-height:18px">{{ needsStockAuth() ? '' : error() }}</p>
        <div class="actions">
          <button type="button" (click)="close()" [disabled]="busy() || !!pending()">{{ hasApproved() ? 'Dejar pendiente' : 'Cancelar venta' }}</button>
          @if (!pending() && !needsStockAuth()) {
            <button type="button" class="primary" (click)="pay()" [disabled]="busy() || !method() || !(amount > 0)">{{ busy() ? 'Cobrando…' : 'Cobrar' }}</button>
          }
        </div>
      }
    </app-modal>
  `,
})
export class PaymentDialog {
  private readonly api = inject(PosApi);
  private readonly cart = inject(CartStore);
  private readonly device = inject(DeviceConfigStore);

  readonly closed = output<void>();
  readonly paid = output<SaleDto>();

  protected readonly stockPerm = Perm.inventarioAjustar;
  protected readonly sale = signal<SaleDto | null>(null);
  protected readonly methods = signal<PaymentMethodDto[]>([]);
  protected readonly method = signal<PaymentMethodDto | null>(null);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly needsStockAuth = signal(false);
  protected readonly previewTotal = computed(() => this.cart.totals().total);
  protected readonly pending = computed(() => this.sale()?.payments.find((p) => p.status === 'pending') ?? null);
  protected readonly hasApproved = computed(() => !!this.sale()?.payments.some((p) => p.status === 'approved'));
  protected readonly bills = computed(() => BILLS.filter((b) => b >= (this.sale()?.remaining ?? 0)));
  protected amount = 0;
  protected tendered: number | null = null;
  protected reference = '';

  /** Una clave por intento: el reintento tras una caída de red no duplica la venta ni el pago. */
  private saleKey = newIdempotencyKey();
  private payKey = newIdempotencyKey();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.timer && clearTimeout(this.timer));
    void this.start();
  }

  protected change(): number {
    return this.method()?.kind === 'cash' && this.tendered ? Math.max(round2(Number(this.tendered) - Number(this.amount)), 0) : 0;
  }

  protected icon(m: PaymentMethodDto): string {
    return m.kind === 'gateway' ? (GATEWAY_ICON[m.gatewayMethod ?? ''] ?? '📲') : (KIND_ICON[m.kind] ?? '💲');
  }

  protected statusLabel(s: string): string {
    return ({ pending: 'en curso', approved: 'aprobado', declined: 'rechazado', cancelled: 'cancelado' } as Record<string, string>)[s] ?? s;
  }

  protected renewKey(): void {
    this.payKey = newIdempotencyKey();
  }

  /** [1] El servidor crea la venta con los precios vigentes; el carrito solo propone productos y cantidades. */
  protected async start(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      const [sale, methods] = await Promise.all([
        this.api.createSale({
          cashRegisterId: this.device.config()!.cashRegisterId,
          customerIdentification: this.cart.customer(),
          lines: this.cart.lines().map((l) => ({
            productId: l.product.id, quantity: l.quantity, discountAmount: discountAmount(l), discountReason: l.discountReason,
          })),
        }, this.saleKey),
        this.api.paymentMethods(),
      ]);
      this.methods.set(methods.filter((m) => m.isActive).sort((a, b) => a.displayOrder - b.displayOrder));
      this.sale.set(sale);
      this.select(this.methods().find((m) => m.kind === 'cash') ?? this.methods()[0] ?? null);
    } catch (e) {
      const err = toApiError(e);
      this.error.set(err.isNetwork ? 'Sin conexión con el servidor: la venta necesita conexión. Intenta de nuevo.' : err.message);
    } finally {
      this.busy.set(false);
    }
  }

  protected select(m: PaymentMethodDto | null): void {
    this.method.set(m);
    this.amount = this.sale()?.remaining ?? 0;
    this.tendered = null;
    this.reference = '';
    this.error.set('');
    this.renewKey();
  }

  /** [2] Registra el pago en el servidor; con Bold queda esperando el webhook. */
  protected async pay(): Promise<void> {
    const s = this.sale();
    const m = this.method();
    if (!s || !m) return;
    const amount = Number(this.amount);
    if (m.kind === 'cash' && this.tendered !== null && Number(this.tendered) < amount) return this.error.set('El recibido es menor que el monto.');
    if (m.requiresReference && !this.reference.trim()) return this.error.set(`${m.name} exige referencia.`);
    this.busy.set(true);
    this.error.set('');
    try {
      const updated = await this.api.addPayment(s.id, {
        paymentMethodId: m.id, amount,
        amountTendered: m.kind === 'cash' && this.tendered ? Number(this.tendered) : null,
        reference: this.reference.trim() || null,
      }, this.payKey);
      this.renewKey();
      this.apply(updated);
    } catch (e) {
      const err = toApiError(e);
      if (!err.isNetwork) this.renewKey();
      if (err.code === 'EXISTENCIAS_INSUFICIENTES') this.needsStockAuth.set(true);
      this.error.set(err.isNetwork ? 'Sin conexión: revisa la red e intenta de nuevo (no se cobra dos veces).' : err.message);
    } finally {
      this.busy.set(false);
    }
  }

  /** D-06: un superior con inventario.ajustar autoriza vender sin existencias; luego se cobra de nuevo. */
  protected async authorizeStock(token: string): Promise<void> {
    try {
      this.sale.set(await this.api.authorizeStock(this.sale()!.id, token));
      this.needsStockAuth.set(false);
      await this.pay();
    } catch (e) {
      this.error.set(toApiError(e).message);
    }
  }

  /** Cerrar: sin pagos se cancela la venta; con pagos aprobados queda pendiente (se ve en Ventas del turno). */
  protected async close(): Promise<void> {
    const s = this.sale();
    if (s && s.status !== 'confirmed' && !this.pending() && !this.hasApproved()) {
      await this.api.cancelSale(s.id).catch(() => undefined);
    }
    this.closed.emit();
  }

  private apply(sale: SaleDto): void {
    this.sale.set(sale);
    if (sale.status === 'confirmed') {
      this.paid.emit(sale);
      return;
    }
    const declined = sale.payments.filter((p) => p.status === 'declined' || p.status === 'cancelled').at(-1);
    if (!this.pending() && declined && this.timer) this.error.set(`${declined.methodName} fue rechazado. Elige otro medio o intenta de nuevo.`);
    this.amount = sale.remaining;
    if (this.pending()) this.poll();
  }

  /** HU-6.5: estado en vivo del pago en el datáfono (lo aprueba el webhook de Bold en el servidor). */
  private poll(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(async () => {
      try {
        this.apply(await this.api.sale(this.sale()!.id));
      } catch (e) {
        if (e instanceof ApiError && e.isNetwork) this.poll();
        else this.error.set(toApiError(e).message);
      }
    }, POLL_MS);
  }
}
