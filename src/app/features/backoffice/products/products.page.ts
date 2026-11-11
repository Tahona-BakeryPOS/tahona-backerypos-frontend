import { ChangeDetectionStrategy, Component, computed, inject, resource, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { newIdempotencyKey } from '../../../core/api/api-client';
import { NegativeStockPolicy, ProductDto } from '../../../core/api/api.models';
import { BackofficeApi } from '../../../core/api/backoffice-api';
import { Perm } from '../../../core/auth/permissions';
import { SessionStore } from '../../../core/auth/session.store';
import { AsyncAction } from '../../../shared/async-action';
import { CopPipe } from '../../../shared/cop.pipe';
import { ModalComponent } from '../../../shared/modal.component';
import { ToastService } from '../../../shared/toast.service';
import { BO_PAGE_STYLES } from '../backoffice.styles';

const PAGE_SIZE = 50;

/**
 * Productos → Catalog (US-3.1 to 3.3). List prices with tax included (D-07). Choosing a
 * branch shows the price in force there (its own or, if it has none, the base one) and its availability.
 * A price change opens a new validity period and the previous one stays in the history.
 */
@Component({
  selector: 'app-products-page',
  imports: [ReactiveFormsModule, FormsModule, CopPipe, ModalComponent, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [BO_PAGE_STYLES, `
    .history { width: 100%; font-size: 13px; margin-top: 8px; }
    .history td, .history th { padding: 4px 6px; }
    .tag { font-size: 11px; color: var(--muted); display: block; }
  `],
  template: `
    <div class="head">
      <div><h1>Catálogo</h1><p>Precios con impuesto incluido. Cambiar un precio abre una vigencia nueva; las anteriores quedan en el historial.</p></div>
      @if (canManage) { <button type="button" class="primary" (click)="openCreate()">＋ Nuevo producto</button> }
    </div>
    <div class="toolbar">
      <input type="search" placeholder="Buscar por nombre, código o barras" style="max-width:280px" [ngModel]="q()" (ngModelChange)="q.set($event); page.set(1)" />
      <select [ngModel]="categoryId()" (ngModelChange)="categoryId.set($event); page.set(1)" aria-label="Categoría">
        <option value="">Todas las categorías</option>
        @for (c of categories.value() ?? []; track c.id) { <option [value]="c.id">{{ c.name }}</option> }
      </select>
      <select [ngModel]="branchId()" (ngModelChange)="branchId.set($event)" aria-label="Sucursal">
        <option value="">Precio base</option>
        @for (b of activeBranches(); track b.id) { <option [value]="b.id">{{ b.name }}</option> }
      </select>
      <label class="row small"><input type="checkbox" style="width:auto;min-height:auto" [ngModel]="inactive()" (ngModelChange)="inactive.set($event); page.set(1)" /> Ver inactivos</label>
    </div>
    @if (products.error()) { <p class="err" role="alert">{{ errorOf(products.error()) }}</p> }
    <div class="card scroll-x">
      <table>
        <thead><tr><th>Código</th><th>Producto</th><th>Categoría</th><th>Impuesto</th><th class="num">Precio</th>@if (branchId()) { <th>En sucursal</th> }<th></th></tr></thead>
        <tbody>
          @for (p of products.value()?.items ?? []; track p.id) {
            <tr>
              <td><code>{{ p.sku }}</code>@if (p.barcode) { <span class="tag">{{ p.barcode }}</span> }</td>
              <td>{{ p.name }}@if (p.allowsDecimals) { <span class="badge">por {{ p.unitCode }}</span> }@if (!p.isActive) { <span class="badge">inactivo</span> }</td>
              <td>{{ p.categoryName }}</td>
              <td>{{ p.taxName }}</td>
              <td class="num" [class.neg]="p.price === null">
                {{ p.price === null ? 'sin precio' : (p.price | cop) }}
                @if (branchId() && p.price !== null) { <span class="tag">{{ p.branchPrice !== null ? 'de la sucursal' : 'base' }}</span> }
              </td>
              @if (branchId()) {
                <td>@if (canBranchPrice) {
                  <label class="row small"><input type="checkbox" style="width:auto;min-height:auto" [checked]="p.isAvailable" (change)="toggleAvailable(p)" [disabled]="action.busy()" /> {{ p.isAvailable ? 'Disponible' : 'No disponible' }}</label>
                } @else { {{ p.isAvailable ? 'Disponible' : 'No disponible' }} }</td>
              }
              <td class="right" style="white-space:nowrap">
                @if (canBranchPrice) { <button type="button" class="sm" (click)="openPrice(p)">Precio</button> }
                @if (canManage) {
                  <button type="button" class="sm" (click)="openEdit(p)">Editar</button>
                  <button type="button" class="ghost sm" (click)="setActive(p, !p.isActive)" [disabled]="action.busy()">{{ p.isActive ? 'Desactivar' : 'Activar' }}</button>
                }
              </td>
            </tr>
          } @empty { <tr><td [attr.colspan]="branchId() ? 7 : 6" class="state">{{ products.isLoading() ? 'Cargando…' : 'Sin productos.' }}</td></tr> }
        </tbody>
      </table>
    </div>
    @if (products.value(); as r) {
      <div class="pager">
        <span>{{ r.totalCount }} productos</span>
        <button type="button" class="sm" (click)="page.set(page() - 1)" [disabled]="page() <= 1">Anterior</button>
        <button type="button" class="sm" (click)="page.set(page() + 1)" [disabled]="page() * pageSize >= r.totalCount">Siguiente</button>
      </div>
    }
    @if (action.error() && !editing() && !pricing()) { <p class="err" role="alert">{{ action.error() }}</p> }

    @if (editing(); as e) {
      <app-modal [title]="e.product ? 'Editar producto' : 'Nuevo producto'" [eyebrow]="e.product?.sku ?? 'Catálogo'" (closed)="editing.set(null)">
        <form [formGroup]="form" (ngSubmit)="save()">
          <div class="two">
            <div class="field"><label for="sku">Código (SKU)</label><input id="sku" formControlName="sku" placeholder="PAN-001" /></div>
            <div class="field"><label for="barcode">Código de barras (opcional)</label><input id="barcode" formControlName="barcode" /></div>
          </div>
          <div class="field"><label for="pname">Nombre</label><input id="pname" formControlName="name" placeholder="Pan francés" /></div>
          <div class="two">
            <div class="field"><label for="cat">Categoría</label>
              <select id="cat" formControlName="categoryId"><option value="">— elegir —</option>
                @for (c of categories.value() ?? []; track c.id) { @if (c.isActive || c.id === e.product?.categoryId) { <option [value]="c.id">{{ c.name }}</option> } }</select></div>
            <div class="field"><label for="tax">Impuesto</label>
              <select id="tax" formControlName="taxId"><option value="">— elegir —</option>
                @for (t of taxes.value() ?? []; track t.id) { @if (t.isActive || t.id === e.product?.taxId) { <option [value]="t.id">{{ t.name }}</option> } }</select></div>
            <div class="field"><label for="unit">Unidad</label>
              <select id="unit" formControlName="unitId"><option value="">— elegir —</option>
                @for (u of units.value() ?? []; track u.id) { <option [value]="u.id">{{ u.name }} ({{ u.code }})</option> }</select></div>
            @if (!e.product) {
              <div class="field"><label for="price">Precio base con impuesto (opcional)</label><input id="price" type="number" min="0" step="0.01" formControlName="price" /></div>
            }
          </div>
          <label class="row small"><input type="checkbox" formControlName="trackStock" style="width:auto;min-height:auto" /> Controlar existencias (la venta descuenta del inventario)</label>
          @if (form.controls.trackStock.value) {
            <div class="field"><label for="policy">Si no hay existencias suficientes</label>
              <select id="policy" formControlName="negativeStockPolicy">
                <option value="allow">Vender igual (el saldo queda negativo) — p. ej. pan del día</option>
                <option value="block">Bloquear, salvo autorización de un superior — p. ej. empacados</option>
              </select></div>
          }
          <p class="small muted">En kilogramo, gramo, libra, litro o mililitro la caja pide la cantidad al vender.</p>
          <p class="err small" role="alert">{{ action.error() }}</p>
          <div class="actions">
            <button type="button" (click)="editing.set(null)">Cancelar</button>
            <button type="submit" class="primary" [disabled]="form.invalid || action.busy()">{{ e.product ? 'Guardar' : 'Crear producto' }}</button>
          </div>
        </form>
      </app-modal>
    }

    @if (pricing(); as p) {
      <app-modal title="Precio" [eyebrow]="p.name" (closed)="pricing.set(null)">
        <form [formGroup]="priceForm" (ngSubmit)="savePrice(p)">
          <div class="two">
            <div class="field"><label for="pScope">Aplica a</label>
              <select id="pScope" formControlName="branchId">
                @if (canManage) { <option value="">Precio base (todas las sucursales)</option> }
                @for (b of activeBranches(); track b.id) { <option [value]="b.id">{{ b.name }}</option> }
              </select></div>
            <div class="field"><label for="pAmount">Nuevo precio</label><input id="pAmount" type="number" min="0" step="0.01" formControlName="amount" /></div>
          </div>
          <div class="field"><label for="pFrom">Rige desde (vacío = ahora)</label><input id="pFrom" type="datetime-local" formControlName="validFrom" /></div>
          <label class="row small"><input type="checkbox" formControlName="includesTax" style="width:auto;min-height:auto" /> El precio incluye el impuesto ({{ p.taxName }})</label>
          <p class="err small" role="alert">{{ action.error() }}</p>
          <div class="actions"><button type="button" (click)="pricing.set(null)">Cerrar</button>
            <button type="submit" class="primary" [disabled]="priceForm.invalid || action.busy()">Abrir vigencia</button></div>
        </form>
        <h3 style="font-size:15px;margin-top:16px">Historial</h3>
        <table class="history">
          <thead><tr><th>Aplica a</th><th class="num">Precio</th><th>Desde</th><th>Hasta</th></tr></thead>
          <tbody>
            @for (h of history.value() ?? []; track h.id) {
              <tr [class.ok]="h.isCurrent"><td>{{ branchName(h.branchId) }}</td><td class="num">{{ h.amount | cop }}@if (!h.includesTax) { <span class="tag">+ impuesto</span> }</td>
                <td>{{ h.validFrom | date: 'dd/MM/yy HH:mm' }}</td><td>{{ h.validTo ? (h.validTo | date: 'dd/MM/yy HH:mm') : (h.isCurrent ? 'vigente' : '—') }}</td></tr>
            } @empty { <tr><td colspan="4" class="muted">{{ history.isLoading() ? 'Cargando…' : 'Sin precios.' }}</td></tr> }
          </tbody>
        </table>
      </app-modal>
    }
  `,
})
export class ProductsPage {
  private readonly bo = inject(BackofficeApi);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly session = inject(SessionStore);
  protected readonly action = new AsyncAction(inject(ToastService));
  protected readonly canManage = this.session.can(Perm.catalogManage);
  protected readonly canBranchPrice = this.canManage || this.session.can(Perm.branchPrices);
  protected readonly pageSize = PAGE_SIZE;

  protected readonly q = signal('');
  protected readonly categoryId = signal('');
  protected readonly branchId = signal('');
  protected readonly inactive = signal(false);
  protected readonly page = signal(1);
  protected readonly editing = signal<{ product: ProductDto | null } | null>(null);
  protected readonly pricing = signal<ProductDto | null>(null);

  protected readonly categories = resource({ loader: () => this.bo.categories() });
  protected readonly taxes = resource({ loader: () => this.bo.taxes() });
  protected readonly units = resource({ loader: () => this.bo.units() });
  protected readonly branches = resource({ loader: () => this.bo.branches() });
  protected readonly activeBranches = computed(() => (this.branches.value() ?? []).filter((b) => b.isActive));
  protected readonly products = resource({
    params: () => ({ search: this.q().trim(), categoryId: this.categoryId() || null, branchId: this.branchId() || null, includeInactive: this.inactive(), page: this.page() }),
    loader: ({ params }) => this.bo.products({ ...params, pageSize: PAGE_SIZE }),
  });
  protected readonly history = resource({
    params: () => this.pricing()?.id,
    loader: ({ params: id }) => this.bo.productPrices(id),
  });

  protected readonly form = this.fb.group({
    sku: ['', [Validators.required, Validators.maxLength(50), Validators.pattern(/^[A-Za-z0-9._-]+$/)]],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    barcode: ['', Validators.maxLength(50)],
    categoryId: ['', Validators.required],
    taxId: ['', Validators.required],
    unitId: ['', Validators.required],
    price: [null as number | null, Validators.min(0)],
    trackStock: [false],
    negativeStockPolicy: ['allow' as NegativeStockPolicy],
  });
  protected readonly priceForm = this.fb.group({
    branchId: [''],
    amount: [0, [Validators.required, Validators.min(0)]],
    validFrom: [''],
    includesTax: [true],
  });

  private createKey = newIdempotencyKey();
  private priceKey = newIdempotencyKey();

  protected errorOf(e: unknown): string {
    return (e as Error)?.message ?? 'No se pudo cargar el catálogo.';
  }

  protected branchName(id: string | null): string {
    return id ? (this.branches.value()?.find((b) => b.id === id)?.name ?? 'Sucursal') : 'Base';
  }

  protected openCreate(): void {
    this.action.error.set('');
    const general = this.categories.value()?.find((c) => c.isActive);
    const unit = this.units.value()?.find((u) => u.code === 'UND');
    this.form.reset({ categoryId: general?.id ?? '', unitId: unit?.id ?? '', price: null, trackStock: false, negativeStockPolicy: 'allow' });
    this.form.controls.sku.enable();
    this.editing.set({ product: null });
  }

  protected openEdit(p: ProductDto): void {
    this.action.error.set('');
    this.form.reset({ sku: p.sku, name: p.name, barcode: p.barcode ?? '', categoryId: p.categoryId, taxId: p.taxId, unitId: p.unitId, price: null, trackStock: p.trackStock, negativeStockPolicy: p.negativeStockPolicy });
    this.form.controls.sku.disable();
    this.editing.set({ product: p });
  }

  protected async save(): Promise<void> {
    const current = this.editing()?.product ?? null;
    const v = this.form.getRawValue();
    const body = { name: v.name.trim(), categoryId: v.categoryId, unitId: v.unitId, taxId: v.taxId, barcode: v.barcode.trim() || null, trackStock: v.trackStock,
      negativeStockPolicy: v.negativeStockPolicy };
    const basePrice = v.price === null || `${v.price}` === '' ? null : Number(v.price);
    const saved = current
      ? await this.action.run(() => this.bo.updateProduct(current, body), 'Producto guardado')
      : await this.action.run(() => this.bo.createProduct({ ...body, sku: v.sku.trim(), basePrice }, this.createKey), 'Producto creado');
    if (!saved) return;
    if (!current) this.createKey = newIdempotencyKey();
    this.editing.set(null);
    this.products.reload();
  }

  protected openPrice(p: ProductDto): void {
    this.action.error.set('');
    const branch = this.branchId() || (this.canManage ? '' : (this.activeBranches()[0]?.id ?? ''));
    this.priceForm.reset({ branchId: branch, amount: (branch ? p.branchPrice : p.basePrice) ?? p.price ?? 0, validFrom: '', includesTax: true });
    this.priceKey = newIdempotencyKey();
    this.pricing.set(p);
  }

  protected async savePrice(p: ProductDto): Promise<void> {
    const v = this.priceForm.getRawValue();
    const saved = await this.action.run(() => this.bo.setPrice(p.id, {
      branchId: v.branchId || null, amount: Number(v.amount), includesTax: v.includesTax,
      validFrom: v.validFrom ? new Date(v.validFrom).toISOString() : null,
    }, this.priceKey), 'Nueva vigencia de precio creada');
    if (!saved) return;
    this.priceKey = newIdempotencyKey();
    this.history.reload();
    this.products.reload();
  }

  protected async toggleAvailable(p: ProductDto): Promise<void> {
    const branch = this.branchId();
    await this.action.run(() => this.bo.setAvailability(branch, p.id, !p.isAvailable), p.isAvailable ? `${p.name}: no disponible` : `${p.name}: disponible`);
    this.products.reload();
  }

  protected async setActive(p: ProductDto, active: boolean): Promise<void> {
    if (!active && !confirm(`¿Desactivar ${p.name}? Deja de aparecer en las cajas; las ventas anteriores no cambian.`)) return;
    const ok = await this.action.run(() => this.bo.setProductActive(p.id, active), active ? `${p.name} activado` : `${p.name} desactivado`);
    if (ok) this.products.reload();
  }
}
