import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal, effect } from '@angular/core';
import { DatePipe } from '@angular/common';
import { SaleDto } from '../../../core/api/api.models';
import { PosApi } from '../../../core/api/pos-api';
import { DeviceConfigStore } from '../../../core/device/device-config.store';
import { CopPipe } from '../../../shared/cop.pipe';
import { ModalComponent } from '../../../shared/modal.component';

const FISCAL: Record<string, string> = {
  not_required: 'Sin factura electrónica (facturación no activa)',
  pending: 'Factura electrónica en trámite',
  accepted: 'Factura electrónica aceptada por la DIAN',
  rejected: 'Factura electrónica rechazada: el administrador debe revisarla',
  in_review: 'Factura electrónica sin confirmar: se está consultando',
};
/** Consultas del estado fiscal mientras el comprobante está abierto. */
const FISCAL_POLLS = 10;

/**
 * HU-6.6: comprobante de la venta confirmada, con el estado de su factura electrónica (Siigo/DIAN). La
 * impresión real queda fuera del MVP; aquí se muestra en pantalla.
 */
@Component({
  selector: 'app-receipt-dialog',
  imports: [CopPipe, DatePipe, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal title="✅ Venta confirmada" (closed)="closed.emit()">
      @let s = current();
      <p class="small" [class.ok]="s.fiscalStatus === 'accepted'" [class.warn]="s.fiscalStatus !== 'accepted'">{{ fiscal(s.fiscalStatus) }}</p>
      <div class="receipt">
        <div style="text-align:center">
          <b>{{ device.config()?.cashRegisterName }}</b><br />
          Venta N° {{ s.number }} · {{ (s.confirmedAt ?? s.createdAt) | date: 'dd/MM/yyyy HH:mm' }}<br />
          @if (s.fiscal?.number) { Factura {{ s.fiscal!.prefix }}{{ s.fiscal!.number }}<br /> }
          Cliente: {{ s.customerIdentification ?? 'Consumidor final' }}
        </div>
        <hr />
        @for (l of s.lines; track l.id) {
          <div class="r"><span>{{ l.quantity }} {{ l.description }}@if (l.discountAmount) { (−{{ l.discountAmount | cop }}) }</span><span>{{ l.lineTotal | cop }}</span></div>
        }
        <hr />
        <div class="r"><span>Base</span><span>{{ s.subtotal | cop }}</span></div>
        @if (s.discountTotal) { <div class="r"><span>Descuentos</span><span>−{{ s.discountTotal | cop }}</span></div> }
        <div class="r"><span>Impuestos</span><span>{{ s.taxTotal | cop }}</span></div>
        <div class="r"><b>TOTAL</b><b>{{ s.total | cop }}</b></div>
        @for (p of s.payments; track p.id) {
          @if (p.status === 'approved') { <div class="r"><span>{{ p.methodName }}</span><span>{{ (p.amountTendered ?? p.amount) | cop }}</span></div> }
        }
        @if (s.change) { <div class="r"><span>CAMBIO</span><span>{{ s.change | cop }}</span></div> }
        @if (s.fiscal?.cufe) { <div class="small" style="word-break:break-all;margin-top:6px">CUFE: {{ s.fiscal!.cufe }}</div> }
        <div style="text-align:center;margin-top:8px">¡Gracias por su compra!</div>
      </div>
      <div class="actions">
        <button type="button" class="primary" (click)="closed.emit()" autofocus>Nueva venta</button>
      </div>
    </app-modal>
  `,
})
export class ReceiptDialog {
  protected readonly device = inject(DeviceConfigStore);
  private readonly api = inject(PosApi);
  readonly sale = input.required<SaleDto>();
  readonly closed = output<void>();
  protected readonly current = signal<SaleDto>(null!);
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      this.current.set(this.sale());
      this.poll(0);
    });
    inject(DestroyRef).onDestroy(() => this.timer && clearTimeout(this.timer));
  }

  protected fiscal(status: string): string {
    return FISCAL[status] ?? status;
  }

  /** La factura se envía en segundo plano: el estado se refresca unas veces mientras el comprobante está abierto. */
  private poll(n: number): void {
    if (this.timer) clearTimeout(this.timer);
    const s = this.current();
    if (n >= FISCAL_POLLS || s.fiscalStatus === 'accepted' || s.fiscalStatus === 'not_required' || s.fiscalStatus === 'rejected') return;
    this.timer = setTimeout(async () => {
      const fresh = await this.api.sale(s.id).catch(() => null);
      if (fresh) this.current.set(fresh);
      this.poll(n + 1);
    }, 3000);
  }
}
