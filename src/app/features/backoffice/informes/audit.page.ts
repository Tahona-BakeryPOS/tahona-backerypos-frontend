import { ChangeDetectionStrategy, Component, inject, resource, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditLogDto } from '../../../core/api/api.models';
import { BackofficeApi } from '../../../core/api/backoffice-api';
import { toApiError } from '../../../core/api/api-error';
import { BO_PAGE_STYLES } from '../backoffice.styles';

const PAGE_SIZE = 50;

/** Nombre legible de cada tabla auditada (esquema.tabla). Las que no estén aquí se muestran tal cual. */
const ENTITY_LABELS: Record<string, string> = {
  'org.companies': 'Empresa', 'org.branches': 'Sucursales', 'cash.cash_registers': 'Cajas',
  'sec.users': 'Usuarios', 'sec.memberships': 'Pertenencias', 'sec.roles': 'Roles', 'sec.role_assignments': 'Asignaciones de rol',
  'sec.devices': 'Dispositivos', 'sec.device_pairing_codes': 'Códigos de vinculación', 'sec.refresh_tokens': 'Sesiones',
  'cat.categories': 'Categorías', 'cat.taxes': 'Impuestos', 'cat.products': 'Productos', 'cat.product_prices': 'Precios',
  'cat.branch_products': 'Disponibilidad por sucursal',
};
const ACTION: Record<string, string> = { creacion: 'creó', modificacion: 'modificó', eliminacion: 'eliminó' };
/** Campos técnicos que no aportan al leer el historial. */
const HIDDEN = ['Id', 'CompanyId', 'RowVersion', 'CreatedAt', 'CreatedBy', 'ModifiedAt', 'ModifiedBy'];

/** Informes → Auditoría y Configuración → Historial de cambios: quién cambió qué, con antes y después. */
@Component({
  selector: 'app-audit-page',
  imports: [DatePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [BO_PAGE_STYLES, `
    .diff { font: 12px/1.5 var(--mono); white-space: pre-wrap; word-break: break-word; margin: 0; max-width: 60ch; }
    .old { color: var(--err); } .new { color: var(--ok); }
    .toolbar label { display: grid; gap: 4px; }
  `],
  template: `
    <div class="head"><div><h1>Historial de cambios</h1><p>Cada cambio queda registrado con su autor y el valor anterior. No se puede editar ni borrar.</p></div></div>
    <div class="toolbar">
      <label class="small muted">Qué cambió
        <select [ngModel]="entity()" (ngModelChange)="entity.set($event); page.set(1)">
          <option value="">Todo</option>
          @for (e of entities.value() ?? []; track e) { <option [value]="e">{{ entityLabel(e) }}</option> }
        </select>
      </label>
      <label class="small muted">Desde <input type="date" [ngModel]="from()" (ngModelChange)="from.set($event); page.set(1)" /></label>
      <label class="small muted">Hasta <input type="date" [ngModel]="to()" (ngModelChange)="to.set($event); page.set(1)" /></label>
    </div>
    @if (log.error(); as e) { <p class="err">{{ msg(e) }}</p> }
    <div class="card scroll-x">
      <table>
        <thead><tr><th>Cuándo</th><th>Quién</th><th>Qué</th><th>Cambio</th></tr></thead>
        <tbody>
          @for (a of log.value()?.items ?? []; track a.id) {
            <tr>
              <td style="white-space:nowrap">{{ a.occurredAt | date: 'dd/MM/yy HH:mm' }}</td>
              <td>{{ a.userName ?? 'Sistema' }}</td>
              <td><b>{{ verb(a.action) }}</b> {{ entityLabel(a.entity).toLowerCase() }}<div class="small muted"><code>{{ a.entityId.slice(0, 8) }}</code></div></td>
              <td>
                @for (c of changes(a); track c.key) {
                  <p class="diff"><b>{{ c.key }}</b>: @if (c.old !== undefined) { <span class="old">{{ c.old }}</span> → } <span class="new">{{ c.new }}</span></p>
                }
              </td>
            </tr>
          } @empty { <tr><td colspan="4" class="state">{{ log.isLoading() ? 'Cargando…' : 'Sin cambios registrados.' }}</td></tr> }
        </tbody>
      </table>
    </div>
    @if (log.value(); as r) {
      <div class="pager">
        <span>{{ r.totalCount }} registros</span>
        <button type="button" class="sm" (click)="page.set(page() - 1)" [disabled]="page() <= 1">Anterior</button>
        <button type="button" class="sm" (click)="page.set(page() + 1)" [disabled]="page() * pageSize >= r.totalCount">Siguiente</button>
      </div>
    }
  `,
})
export class AuditPage {
  private readonly bo = inject(BackofficeApi);
  protected readonly pageSize = PAGE_SIZE;
  protected readonly entity = signal('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly page = signal(1);
  protected readonly entities = resource({ loader: () => this.bo.auditEntities() });
  protected readonly log = resource({
    params: () => ({ entity: this.entity(), from: this.from(), to: this.to(), page: this.page() }),
    loader: ({ params: p }) => this.bo.auditLog({
      entity: p.entity || null,
      // Días completos en la hora local del navegador.
      from: p.from ? new Date(`${p.from}T00:00:00`).toISOString() : null,
      to: p.to ? new Date(`${p.to}T23:59:59.999`).toISOString() : null,
      page: p.page, pageSize: PAGE_SIZE,
    }),
  });

  protected verb(a: string): string {
    return ACTION[a] ?? a;
  }

  protected entityLabel(e: string): string {
    return ENTITY_LABELS[e] ?? e;
  }

  /** Campos cambiados: en una modificación, valor anterior → nuevo; en una creación, solo el nuevo. */
  protected changes(a: AuditLogDto): { key: string; old?: string; new: string }[] {
    const parse = (s: string | null) => (s ? (JSON.parse(s) as Record<string, unknown>) : {});
    const oldV = parse(a.oldValues);
    const newV = parse(a.newValues);
    return Object.keys(newV)
      .filter((k) => !HIDDEN.includes(k))
      .slice(0, 8)
      .map((k) => ({ key: k, old: a.oldValues ? show(oldV[k]) : undefined, new: show(newV[k]) }));
  }

  protected msg(e: unknown): string {
    return toApiError(e).message;
  }
}

const show = (v: unknown): string => (v === null || v === undefined ? '∅' : typeof v === 'object' ? JSON.stringify(v) : String(v));
