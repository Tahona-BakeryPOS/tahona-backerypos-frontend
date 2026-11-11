import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FiscalAttemptDto, FiscalDocumentDto } from '../../../core/api/api.models';
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
  pending: 'pendiente', submitting: 'enviando', accepted: 'aceptada', rejected: 'rechazada', temporary_error: 'error temporal',
  unknown: 'sin confirmar', cancelled: 'cancelada',
};

/**
 * Ventas y caja → Electronic invoices: each document with its status at the DIAN (via Siigo). It is only
 * "accepted" with a CUFE. Rejected or errored ones are retried after fixing the cause; the PDF comes from Siigo.
 */
@Component({
  selector: 'app-fiscal-documents-page',
  imports: [DatePipe, CopPipe, DateRangeComponent, FormsModule, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [BO_PAGE_STYLES, `.cufe { font: 11px var(--mono); word-break: break-all; max-width: 28ch; }`],
  template: `
    <div class="head"><div><h1>Facturas electrónicas</h1><p>Estado ante la DIAN de cada factura enviada por Siigo. El XML se consulta en Siigo Nube.</p></div></div>
    <div class="toolbar">
      <app-date-range [(from)]="from" [(to)]="to" />
      <select [ngModel]="status()" (ngModelChange)="status.set($event)" aria-label="Estado">
        <option value="">Todos</option>
        @for (s of statuses; track s[0]) { <option [value]="s[0]">{{ s[1] }}</option> }
      </select>
    </div>
    @if (docs.error(); as e) { <p class="err">{{ msg(e) }}</p> }
    @if (action.error()) { <p class="err" role="alert">{{ action.error() }}</p> }
    <div class="card scroll-x">
      <table>
        <thead><tr><th>Fecha</th><th>Número</th><th>Cliente</th><th class="num">Total</th><th>Estado</th><th>CUFE / error</th><th></th></tr></thead>
        <tbody>
          @for (d of docs.value() ?? []; track d.id) {
            <tr>
              <td style="white-space:nowrap">{{ d.createdAt | date: 'dd/MM HH:mm' }}</td>
              <td>{{ d.prefix ?? '' }}{{ d.number ?? '—' }}</td>
              <td>{{ d.customerIdentification }}</td>
              <td class="num">{{ d.total | cop }}</td>
              <td><span class="badge" [class.ok]="d.status === 'accepted'" [class.err]="d.status === 'rejected'" [class.warn]="d.status === 'unknown' || d.status === 'temporary_error'">{{ label(d.status) }}</span>
                <div class="small muted">{{ d.attempts }} intento(s)</div></td>
              <td>@if (d.cufe) { <div class="cufe">{{ d.cufe }}</div> } @else if (d.errors) { <div class="small err">{{ d.errors }}</div> } @else { — }</td>
              <td style="white-space:nowrap">
                @if (d.status === 'accepted') { <a class="sm" [href]="'/api/v1/fiscal-documents/' + d.id + '/pdf'" (click)="$event.preventDefault(); pdf(d)">PDF</a> }
                @if (canManage) {
                  <button type="button" class="ghost sm" (click)="showAttempts(d)">Intentos</button>
                  @if (d.status === 'rejected' || d.status === 'temporary_error' || d.status === 'unknown') {
                    <button type="button" class="sm" (click)="retry(d)" [disabled]="action.busy()">Reintentar</button>
                  }
                }
              </td>
            </tr>
          } @empty { <tr><td colspan="7" class="state">{{ docs.isLoading() ? 'Cargando…' : 'Sin documentos en el rango.' }}</td></tr> }
        </tbody>
      </table>
    </div>

    @if (attempts(); as a) {
      <app-modal title="Intentos de envío" [eyebrow]="a.doc.prefix ? a.doc.prefix + a.doc.number : 'Documento'" (closed)="attempts.set(null)">
        <table>
          <thead><tr><th>#</th><th>Cuándo</th><th>Operación</th><th>Resultado</th><th>Detalle</th></tr></thead>
          <tbody>@for (x of a.list; track $index) {
            <tr><td>{{ x.number }}</td><td>{{ x.occurredAt | date: 'dd/MM HH:mm:ss' }}</td><td>{{ x.operation }}</td><td>{{ x.outcome }}@if (x.httpStatus) { · {{ x.httpStatus }} }</td>
              <td class="small">{{ x.detail ?? '—' }}</td></tr>
          } @empty { <tr><td colspan="5" class="muted">Sin intentos.</td></tr> }</tbody>
        </table>
        <div class="actions"><button type="button" class="primary" (click)="attempts.set(null)">Cerrar</button></div>
      </app-modal>
    }
  `,
})
export class FiscalDocumentsPage {
  private readonly bo = inject(BackofficeApi);
  protected readonly canManage = inject(SessionStore).can(Perm.fiscalManage);
  protected readonly action = new AsyncAction(inject(ToastService));
  protected readonly statuses = Object.entries(STATUS);
  protected readonly from = signal(daysAgo(6));
  protected readonly to = signal(daysAgo(0));
  protected readonly status = signal('');
  protected readonly attempts = signal<{ doc: FiscalDocumentDto; list: FiscalAttemptDto[] } | null>(null);
  protected readonly docs = resource({
    params: () => ({ from: this.from(), to: this.to(), status: this.status() || null }),
    loader: ({ params: p }) => this.bo.fiscalDocuments({ from: p.from, to: p.to }, p.status),
  });

  protected label(s: string): string {
    return STATUS[s] ?? s;
  }

  protected async retry(d: FiscalDocumentDto): Promise<void> {
    const ok = await this.action.run(() => this.bo.retryFiscalDocument(d.id), 'Documento reenviado a la cola');
    if (ok) this.docs.reload();
  }

  protected async showAttempts(d: FiscalDocumentDto): Promise<void> {
    const list = await this.action.run(() => this.bo.fiscalAttempts(d.id));
    if (list) this.attempts.set({ doc: d, list });
  }

  /** Download with the session's token (a direct link would not send it). */
  protected async pdf(d: FiscalDocumentDto): Promise<void> {
    await this.action.run(async () => {
      const blob = await this.bo.fiscalDocumentPdf(d.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    });
  }

  protected msg(e: unknown): string {
    return toApiError(e).message;
  }
}
