import { ChangeDetectionStrategy, Component, computed, effect, inject, resource, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { newIdempotencyKey } from '../../../core/api/api-client';
import { ReconciliationDto } from '../../../core/api/api.models';
import { BackofficeApi } from '../../../core/api/backoffice-api';
import { Perm } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { AsyncAction } from '../../../shared/async-action';
import { ModalComponent } from '../../../shared/modal.component';
import { ToastService } from '../../../shared/toast.service';
import { BO_PAGE_STYLES } from '../backoffice.styles';

const PAGE_SIZE = 50;

/**
 * Productos e inventario → Stock (US-4.2, US-4.6): balance of each product that tracks
 * stock per location of the branch, locations and reconciliation (balance = Σ movements).
 */
@Component({
  selector: 'app-stock-page',
  imports: [FormsModule, ReactiveFormsModule, DecimalPipe, DatePipe, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: BO_PAGE_STYLES,
  template: `
    <div class="head">
      <div><h1>Existencias</h1><p>El saldo no se edita: cambia con la existencia inicial, los ajustes, el conteo físico y las ventas.</p></div>
      <div class="row">
        <button type="button" (click)="reconcile()" [disabled]="!branchId() || action.busy()">Verificar saldos</button>
        @if (canAdjust) { <button type="button" (click)="openLocation()" [disabled]="!branchId()">＋ Ubicación</button> }
      </div>
    </div>
    <div class="toolbar">
      <select [ngModel]="branchId()" (ngModelChange)="branchId.set($event); locationId.set(''); page.set(1)" aria-label="Sucursal">
        @for (b of activeBranches(); track b.id) { <option [value]="b.id">{{ b.name }}</option> }
      </select>
      <select [ngModel]="locationId()" (ngModelChange)="locationId.set($event); page.set(1)" aria-label="Ubicación">
        <option value="">Todas las ubicaciones</option>
        @for (l of locations.value() ?? []; track l.id) { <option [value]="l.id">{{ l.name }}@if (l.isDefault) { (ventas) }</option> }
      </select>
      <input type="search" placeholder="Buscar producto" style="max-width:240px" [ngModel]="q()" (ngModelChange)="q.set($event); page.set(1)" />
    </div>
    @if (stock.error()) { <p class="err" role="alert">{{ errorOf(stock.error()) }}</p> }
    @if (action.error()) { <p class="err" role="alert">{{ action.error() }}</p> }
    <div class="card scroll-x">
      <table>
        <thead><tr><th>Código</th><th>Producto</th><th>Ubicación</th><th class="num">Existencia</th><th>Sin existencias</th></tr></thead>
        <tbody>
          @for (r of stock.value()?.items ?? []; track r.productId + r.locationId) {
            <tr>
              <td><code>{{ r.sku }}</code></td>
              <td>{{ r.productName }}</td>
              <td>{{ r.locationName }}</td>
              <td class="num" [class.neg]="r.onHand < 0">{{ r.onHand | number: '1.0-4' }} {{ r.unitCode }}@if (!r.hasMovements) { <span class="small muted"> · sin inicial</span> }</td>
              <td><span class="badge" [class.warn]="!r.allowNegative">{{ r.allowNegative ? 'vende igual' : 'bloquea' }}</span></td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="state">{{ stock.isLoading() ? 'Cargando…' : 'No hay productos que controlen existencias. Actívalo en Catálogo y precios.' }}</td></tr>
          }
        </tbody>
      </table>
    </div>
    @if (stock.value(); as r) {
      <div class="pager">
        <span>{{ r.totalCount }} productos</span>
        <button type="button" class="sm" (click)="page.set(page() - 1)" [disabled]="page() <= 1">Anterior</button>
        <button type="button" class="sm" (click)="page.set(page() + 1)" [disabled]="page() * pageSize >= r.totalCount">Siguiente</button>
      </div>
    }

    @if (reconciliation(); as rec) {
      <app-modal title="Verificación de saldos" [eyebrow]="'Revisado ' + (rec.checkedAt | date: 'dd/MM/yy HH:mm')" (closed)="reconciliation.set(null)">
        @if (rec.differences.length === 0) {
          <p class="ok">Los {{ rec.balancesChecked }} saldos cuadran con la suma de sus movimientos.</p>
        } @else {
          <p class="err">{{ rec.differences.length }} saldos no cuadran. Esto indica un error del sistema: avísale a soporte.</p>
          <table>
            <thead><tr><th>Producto</th><th>Ubicación</th><th class="num">Saldo</th><th class="num">Σ movimientos</th></tr></thead>
            <tbody>@for (d of rec.differences; track d.productId + d.locationId) {
              <tr><td>{{ d.productName }}</td><td>{{ d.locationName }}</td><td class="num">{{ d.onHand }}</td><td class="num">{{ d.expected }}</td></tr>
            }</tbody>
          </table>
        }
        <div class="actions"><button type="button" class="primary" (click)="reconciliation.set(null)">Listo</button></div>
      </app-modal>
    }

    @if (creatingLocation()) {
      <app-modal title="Nueva ubicación" eyebrow="Existencias" (closed)="creatingLocation.set(false)">
        <form [formGroup]="locationForm" (ngSubmit)="createLocation()">
          <div class="two">
            <div class="field"><label for="lCode">Código</label><input id="lCode" formControlName="code" placeholder="VITRINA" maxlength="20" /></div>
            <div class="field"><label for="lName">Nombre</label><input id="lName" formControlName="name" placeholder="Vitrina" /></div>
          </div>
          <p class="small muted">Las ventas descuentan de la ubicación por defecto de la sucursal.</p>
          <p class="err small" role="alert">{{ locationAction.error() }}</p>
          <div class="actions"><button type="button" (click)="creatingLocation.set(false)">Cancelar</button>
            <button type="submit" class="primary" [disabled]="locationForm.invalid || locationAction.busy()">Crear</button></div>
        </form>
      </app-modal>
    }
  `,
})
export class StockPage {
  private readonly bo = inject(BackofficeApi);
  private readonly toast = inject(ToastService);
  protected readonly canAdjust = inject(SessionStore).can(Perm.inventoryAdjust);
  protected readonly action = new AsyncAction(this.toast);
  protected readonly locationAction = new AsyncAction(this.toast);
  protected readonly pageSize = PAGE_SIZE;

  protected readonly branchId = signal('');
  protected readonly locationId = signal('');
  protected readonly q = signal('');
  protected readonly page = signal(1);
  protected readonly reconciliation = signal<ReconciliationDto | null>(null);
  protected readonly creatingLocation = signal(false);

  protected readonly branches = resource({ loader: () => this.bo.branches() });
  protected readonly activeBranches = computed(() => (this.branches.value() ?? []).filter((b) => b.isActive));
  protected readonly locations = resource({
    params: () => this.branchId() || undefined,
    loader: ({ params: id }) => this.bo.stockLocations(id),
  });
  protected readonly stock = resource({
    params: () => (this.branchId() ? { branchId: this.branchId(), locationId: this.locationId() || null, search: this.q().trim(), page: this.page() } : undefined),
    loader: ({ params }) => this.bo.stock({ ...params, pageSize: PAGE_SIZE }),
  });
  protected readonly locationForm = inject(FormBuilder).nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(20), Validators.pattern(/^[A-Za-z0-9_-]+$/)]],
    name: ['', [Validators.required, Validators.maxLength(80)]],
  });
  private locationKey = newIdempotencyKey();

  constructor() {
    // First active branch by default.
    effect(() => {
      const first = this.activeBranches()[0];
      if (first && !this.branchId()) this.branchId.set(first.id);
    });
  }

  protected errorOf(e: unknown): string {
    return (e as Error)?.message ?? 'No se pudieron cargar las existencias.';
  }

  protected async reconcile(): Promise<void> {
    const r = await this.action.run(() => this.bo.reconciliation(this.branchId()));
    if (r) this.reconciliation.set(r);
  }

  protected openLocation(): void {
    this.locationAction.error.set('');
    this.locationForm.reset();
    this.creatingLocation.set(true);
  }

  protected async createLocation(): Promise<void> {
    const v = this.locationForm.getRawValue();
    const created = await this.locationAction.run(
      () => this.bo.createStockLocation({ branchId: this.branchId(), code: v.code.trim().toUpperCase(), name: v.name.trim() }, this.locationKey),
      'Ubicación creada');
    if (!created) return;
    this.locationKey = newIdempotencyKey();
    this.creatingLocation.set(false);
    this.locations.reload();
    this.stock.reload();
  }
}
