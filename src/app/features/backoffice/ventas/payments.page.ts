import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { PaymentDto } from '../../../core/api/api.models';
import { BackofficeApi } from '../../../core/api/backoffice-api';
import { toApiError } from '../../../core/api/api-error';
import { Perm } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { AsyncAction } from '../../../shared/async-action';
import { CopPipe } from '../../../shared/cop.pipe';
import { DateRangeComponent, daysAgo } from '../../../shared/date-range.component';
import { ModalComponent } from '../../../shared/modal.component';
import { ToastService } from '../../../shared/toast.service';
import { BO_PAGE_STYLES } from '../backoffice.styles';

const STATUS: Record<string, string> = {
  pending: 'pendiente', approved: 'aprobado', declined: 'rechazado', cancelled: 'cancelado', refunded: 'reembolsado', partially_refunded: 'reembolso parcial',
};

/**
 * Ventas y caja → Pagos: pagos por pasarela con su estado. Un pago pendiente bloquea el cierre de su caja
 * (D-12); si el webhook de Bold no llegó, quien tenga pagos.resolver lo resuelve a mano (I-23): aprobado
 * con el número de aprobación del recibo, rechazado o cancelado (tras verificar en el datáfono).
 */
@Component({
  selector: 'app-payments-page',
  imports: [DatePipe, CopPipe, DateRangeComponent, FormsModule, ReactiveFormsModule, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: BO_PAGE_STYLES,
  template: `
    <div class="head"><div><h1>Pagos</h1><p>Un pago pendiente bloquea el cierre de su caja. Resuélvelo a mano solo si el datáfono ya dio el resultado y Bold no lo notificó.</p></div></div>
    <div class="toolbar">
      <app-date-range [(from)]="from" [(to)]="to" />
      <select [ngModel]="status()" (ngModelChange)="status.set($event)" aria-label="Estado">
        <option value="">Todos</option>
        @for (s of statuses; track s[0]) { <option [value]="s[0]">{{ s[1] }}</option> }
      </select>
    </div>
    @if (payments.error(); as e) { <p class="err">{{ msg(e) }}</p> }
    <div class="card scroll-x">
      <table>
        <thead><tr><th>Fecha</th><th>Medio</th><th class="num">Monto</th><th>Estado</th><th>Bold</th><th>Referencia</th><th></th></tr></thead>
        <tbody>
          @for (p of payments.value() ?? []; track p.id) {
            <tr>
              <td style="white-space:nowrap">{{ p.createdAt | date: 'dd/MM HH:mm' }}@if (p.purpose === 'test') { <div class="small muted">prueba</div> }</td>
              <td>{{ p.paymentMethodName }}</td>
              <td class="num">{{ p.amount | cop }}</td>
              <td><span class="badge" [class.ok]="p.status === 'approved'" [class.warn]="p.status === 'pending'" [class.err]="p.status === 'declined'">{{ label(p.status) }}</span>
                @if (p.resolvedManually) { <div class="small muted">a mano: {{ p.resolutionNote }}</div> }</td>
              <td class="small">{{ p.attemptStatus ?? '—' }}@if (p.attemptError) { <div class="err">{{ p.attemptError }}</div> }</td>
              <td>{{ p.reference ?? '—' }}</td>
              <td>@if (p.status === 'pending' && canResolve) { <button type="button" class="sm" (click)="openResolve(p)">Resolver</button> }</td>
            </tr>
          } @empty { <tr><td colspan="7" class="state">{{ payments.isLoading() ? 'Cargando…' : 'Sin pagos en el rango.' }}</td></tr> }
        </tbody>
      </table>
    </div>

    @if (resolving(); as p) {
      <app-modal title="Resolver pago a mano" [eyebrow]="p.paymentMethodName + ' · ' + (p.amount | cop)" (closed)="resolving.set(null)">
        <p class="small">Úsalo solo si el webhook de Bold no llegó. Queda registrado con tu nombre.</p>
        <form [formGroup]="form" (ngSubmit)="resolve(p)">
          <div class="field"><label for="rRes">Resultado</label>
            <select id="rRes" formControlName="resolution">
              <option value="approved">Aprobado (el recibo del datáfono lo muestra)</option>
              <option value="declined">Rechazado</option>
              <option value="cancelled">Cancelado (verifiqué que el datáfono no cobró)</option>
            </select></div>
          @if (form.controls.resolution.value === 'approved') {
            <div class="field"><label for="rNum">Número de aprobación del recibo</label><input id="rNum" formControlName="approvalNumber" maxlength="100" /></div>
          }
          <div class="field"><label for="rNote">Motivo</label><input id="rNote" formControlName="note" maxlength="300" placeholder="El webhook no llegó; recibo #…" /></div>
          <p class="err small" role="alert">{{ action.error() }}</p>
          <div class="actions"><button type="button" (click)="resolving.set(null)">Cancelar</button>
            <button type="submit" class="primary" [disabled]="form.invalid || action.busy() || (form.controls.resolution.value === 'approved' && !form.controls.approvalNumber.value.trim())">Guardar</button></div>
        </form>
      </app-modal>
    }
  `,
})
export class PaymentsPage {
  private readonly bo = inject(BackofficeApi);
  protected readonly canResolve = inject(SessionStore).can(Perm.pagosResolver);
  protected readonly action = new AsyncAction(inject(ToastService));
  protected readonly statuses = Object.entries(STATUS);
  protected readonly from = signal(daysAgo(6));
  protected readonly to = signal(daysAgo(0));
  protected readonly status = signal('');
  protected readonly resolving = signal<PaymentDto | null>(null);
  protected readonly payments = resource({
    params: () => ({ from: this.from(), to: this.to(), status: this.status() || null }),
    loader: ({ params: p }) => this.bo.payments({ from: p.from, to: p.to }, p.status),
  });
  protected readonly form = inject(FormBuilder).nonNullable.group({
    resolution: ['approved' as 'approved' | 'declined' | 'cancelled'],
    approvalNumber: [''],
    note: ['', [Validators.required, Validators.maxLength(300)]],
  });

  protected label(s: string): string {
    return STATUS[s] ?? s;
  }

  protected openResolve(p: PaymentDto): void {
    this.action.error.set('');
    this.form.reset({ resolution: 'approved', approvalNumber: '', note: '' });
    this.resolving.set(p);
  }

  protected async resolve(p: PaymentDto): Promise<void> {
    const v = this.form.getRawValue();
    const done = await this.action.run(() => this.bo.resolvePayment(p.id, {
      resolution: v.resolution, approvalNumber: v.resolution === 'approved' ? v.approvalNumber.trim() : null, note: v.note.trim(),
    }), 'Pago resuelto');
    if (done) { this.resolving.set(null); this.payments.reload(); }
  }

  protected msg(e: unknown): string {
    return toApiError(e).message;
  }
}
