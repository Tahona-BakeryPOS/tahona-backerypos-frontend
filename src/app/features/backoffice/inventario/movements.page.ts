import { ChangeDetectionStrategy, Component, computed, effect, inject, resource, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BackofficeApi } from '../../../core/api/backoffice-api';
import { BO_PAGE_STYLES } from '../backoffice.styles';

const PAGE_SIZE = 50;

export const MOVEMENT_KINDS: Record<string, string> = {
  initial: 'Existencia inicial', sale: 'Venta', return: 'Devolución', void_reversal: 'Anulación de venta',
  adjustment_in: 'Ajuste (entrada)', adjustment_out: 'Ajuste (salida)',
};

/** Productos e inventario → Movimientos: libro de solo inserción, del más reciente al más antiguo. */
@Component({
  selector: 'app-movements-page',
  imports: [FormsModule, DatePipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [BO_PAGE_STYLES, `.toolbar label { display: grid; gap: 4px; }`],
  template: `
    <div class="head"><div><h1>Movimientos de inventario</h1><p>Cada entrada y salida con su origen, motivo y quién la registró o autorizó. No se editan ni se borran.</p></div></div>
    <div class="toolbar">
      <label class="small muted">Sucursal
        <select [ngModel]="branchId()" (ngModelChange)="branchId.set($event); locationId.set(''); page.set(1)">
          @for (b of activeBranches(); track b.id) { <option [value]="b.id">{{ b.name }}</option> }
        </select></label>
      <label class="small muted">Ubicación
        <select [ngModel]="locationId()" (ngModelChange)="locationId.set($event); page.set(1)">
          <option value="">Todas</option>
          @for (l of locations.value() ?? []; track l.id) { <option [value]="l.id">{{ l.name }}</option> }
        </select></label>
      <label class="small muted">Tipo
        <select [ngModel]="kind()" (ngModelChange)="kind.set($event); page.set(1)">
          <option value="">Todos</option>
          @for (k of kinds; track k[0]) { <option [value]="k[0]">{{ k[1] }}</option> }
        </select></label>
      <label class="small muted">Desde <input type="date" [ngModel]="from()" (ngModelChange)="from.set($event); page.set(1)" /></label>
      <label class="small muted">Hasta <input type="date" [ngModel]="to()" (ngModelChange)="to.set($event); page.set(1)" /></label>
    </div>
    @if (movements.error()) { <p class="err" role="alert">{{ errorOf(movements.error()) }}</p> }
    <div class="card scroll-x">
      <table>
        <thead><tr><th>Cuándo</th><th>Producto</th><th>Ubicación</th><th>Tipo</th><th class="num">Cantidad</th><th>Motivo</th><th>Quién</th></tr></thead>
        <tbody>
          @for (m of movements.value()?.items ?? []; track m.id) {
            <tr>
              <td style="white-space:nowrap">{{ m.occurredAt | date: 'dd/MM/yy HH:mm' }}</td>
              <td>{{ m.productName }} <span class="small muted">· {{ m.sku }}</span></td>
              <td>{{ m.locationName }}</td>
              <td>{{ kindLabel(m.kind) }}</td>
              <td class="num" [class.pos]="m.quantity > 0" [class.neg]="m.quantity < 0">{{ m.quantity > 0 ? '+' : '' }}{{ m.quantity | number: '1.0-4' }} {{ m.unitCode }}</td>
              <td>{{ m.reasonName ?? '—' }}@if (m.note) { <div class="small muted">{{ m.note }}</div> }</td>
              <td>{{ m.userName ?? '—' }}@if (m.authorizedByName && m.authorizedByName !== m.userName) { <div class="small muted">autorizó {{ m.authorizedByName }}</div> }</td>
            </tr>
          } @empty { <tr><td colspan="7" class="state">{{ movements.isLoading() ? 'Cargando…' : 'Sin movimientos.' }}</td></tr> }
        </tbody>
      </table>
    </div>
    @if (movements.value(); as r) {
      <div class="pager">
        <span>{{ r.totalCount }} movimientos</span>
        <button type="button" class="sm" (click)="page.set(page() - 1)" [disabled]="page() <= 1">Anterior</button>
        <button type="button" class="sm" (click)="page.set(page() + 1)" [disabled]="page() * pageSize >= r.totalCount">Siguiente</button>
      </div>
    }
  `,
})
export class MovementsPage {
  private readonly bo = inject(BackofficeApi);
  protected readonly kinds = Object.entries(MOVEMENT_KINDS);
  protected readonly pageSize = PAGE_SIZE;
  protected readonly branchId = signal('');
  protected readonly locationId = signal('');
  protected readonly kind = signal('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly page = signal(1);

  protected readonly branches = resource({ loader: () => this.bo.branches() });
  protected readonly activeBranches = computed(() => (this.branches.value() ?? []).filter((b) => b.isActive));
  protected readonly locations = resource({
    params: () => this.branchId() || undefined,
    loader: ({ params: id }) => this.bo.stockLocations(id),
  });
  protected readonly movements = resource({
    params: () => (this.branchId()
      ? { branchId: this.branchId(), locationId: this.locationId() || null, kind: this.kind() || null, from: this.from(), to: this.to(), page: this.page() }
      : undefined),
    loader: ({ params: p }) => this.bo.stockMovements({
      ...p,
      // Días completos en la hora local del navegador.
      from: p.from ? new Date(`${p.from}T00:00:00`).toISOString() : null,
      to: p.to ? new Date(`${p.to}T23:59:59.999`).toISOString() : null,
      pageSize: PAGE_SIZE,
    }),
  });

  constructor() {
    effect(() => {
      const first = this.activeBranches()[0];
      if (first && !this.branchId()) this.branchId.set(first.id);
    });
  }

  protected kindLabel(k: string): string {
    return MOVEMENT_KINDS[k] ?? k;
  }

  protected errorOf(e: unknown): string {
    return (e as Error)?.message ?? 'No se pudieron cargar los movimientos.';
  }
}
