import { ChangeDetectionStrategy, Component, computed, effect, inject, resource, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { newIdempotencyKey } from '../../../core/api/api-client';
import { CountResultLine, StockRowDto } from '../../../core/api/api.models';
import { BackofficeApi } from '../../../core/api/backoffice-api';
import { AsyncAction } from '../../../shared/async-action';
import { ModalComponent } from '../../../shared/modal.component';
import { ToastService } from '../../../shared/toast.service';
import { BO_PAGE_STYLES } from '../backoffice.styles';

type Tab = 'ajuste' | 'inicial' | 'conteo';

/** Productos de la ubicación que se cargan para elegir y contar (máximo de la API). */
const ROWS = 200;

/**
 * Productos e inventario → Ajustes (HU-4.1, HU-4.4): ajuste con motivo obligatorio, existencia inicial
 * (una vez por producto y ubicación) y conteo físico, que ajusta cada producto a lo contado. Quien
 * registra queda como autorizador. Un reintento por caída de red reusa la misma Idempotency-Key.
 */
@Component({
  selector: 'app-adjustments-page',
  imports: [FormsModule, ReactiveFormsModule, DecimalPipe, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [BO_PAGE_STYLES, `
    .tabs { display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; }
    .tabs button.active { background: var(--brand); color: #fff; border-color: var(--brand); }
    td input { max-width: 120px; min-height: 36px; text-align: right; }
  `],
  template: `
    <div class="head"><div><h1>Ajustes de inventario</h1><p>Toda entrada o salida fuera de las ventas, siempre con motivo. Quien la registra queda como autorizador.</p></div></div>
    <div class="toolbar">
      <select [ngModel]="branchId()" (ngModelChange)="branchId.set($event); locationId.set('')" aria-label="Sucursal">
        @for (b of activeBranches(); track b.id) { <option [value]="b.id">{{ b.name }}</option> }
      </select>
      <select [ngModel]="locationId()" (ngModelChange)="locationId.set($event)" aria-label="Ubicación">
        @for (l of locations.value() ?? []; track l.id) { <option [value]="l.id">{{ l.name }}</option> }
      </select>
      <input type="search" placeholder="Buscar producto" style="max-width:220px" [ngModel]="q()" (ngModelChange)="q.set($event)" />
    </div>
    <div class="tabs" role="tablist">
      <button type="button" [class.active]="tab() === 'ajuste'" (click)="tab.set('ajuste')">Ajuste con motivo</button>
      <button type="button" [class.active]="tab() === 'inicial'" (click)="tab.set('inicial')">Existencia inicial</button>
      <button type="button" [class.active]="tab() === 'conteo'" (click)="tab.set('conteo')">Conteo físico</button>
    </div>
    @if (rows.error()) { <p class="err" role="alert">{{ errorOf(rows.error()) }}</p> }

    @switch (tab()) {
      @case ('ajuste') {
        <form class="card pad" style="max-width:640px" [formGroup]="adjust" (ngSubmit)="saveAdjustment()">
          <div class="field"><label for="aProduct">Producto</label>
            <select id="aProduct" formControlName="productId"><option value="">— elegir —</option>
              @for (r of rows.value()?.items ?? []; track r.productId) { <option [value]="r.productId">{{ r.productName }} · hay {{ r.onHand | number: '1.0-4' }} {{ r.unitCode }}</option> }
            </select></div>
          <div class="two">
            <div class="field"><label for="aDir">Tipo</label>
              <select id="aDir" formControlName="direction"><option value="in">Entrada (+)</option><option value="out">Salida (−)</option></select></div>
            <div class="field"><label for="aQty">Cantidad</label><input id="aQty" type="number" min="0" step="any" formControlName="quantity" /></div>
          </div>
          <div class="field"><label for="aReason">Motivo</label>
            <select id="aReason" formControlName="reasonId"><option value="">— elegir —</option>
              @for (r of reasonsFor(adjust.controls.direction.value); track r.id) { <option [value]="r.id">{{ r.name }}</option> }
            </select></div>
          <div class="field"><label for="aNote">Nota (opcional)</label><input id="aNote" formControlName="note" maxlength="200" /></div>
          <p class="err small" role="alert">{{ action.error() }}</p>
          <button type="submit" class="primary" [disabled]="adjust.invalid || !locationId() || action.busy()">Registrar ajuste</button>
        </form>
      }
      @case ('inicial') {
        <div class="card scroll-x">
          <table>
            <thead><tr><th>Producto</th><th class="num">Cantidad inicial</th></tr></thead>
            <tbody>
              @for (r of withoutInitial(); track r.productId) {
                <tr><td>{{ r.productName }} <span class="small muted">· {{ r.sku }}</span></td>
                  <td class="num"><input type="number" min="0" step="any" [ngModel]="qty()[r.productId] ?? ''" (ngModelChange)="setQty(r.productId, $event)" [attr.aria-label]="'Cantidad de ' + r.productName" /> {{ r.unitCode }}</td></tr>
              } @empty { <tr><td colspan="2" class="state">{{ rows.isLoading() ? 'Cargando…' : 'Todos los productos ya tienen existencia inicial en esta ubicación. Usa un ajuste.' }}</td></tr> }
            </tbody>
          </table>
        </div>
        <p class="err small" role="alert">{{ action.error() }}</p>
        <button type="button" class="primary" (click)="saveInitial()" [disabled]="!filledLines().length || action.busy()">Registrar {{ filledLines().length }} productos</button>
      }
      @case ('conteo') {
        <div class="card scroll-x">
          <table>
            <thead><tr><th>Producto</th><th class="num">Según sistema</th><th class="num">Contado</th></tr></thead>
            <tbody>
              @for (r of rows.value()?.items ?? []; track r.productId) {
                <tr><td>{{ r.productName }} <span class="small muted">· {{ r.sku }}</span></td>
                  <td class="num" [class.neg]="r.onHand < 0">{{ r.onHand | number: '1.0-4' }} {{ r.unitCode }}</td>
                  <td class="num"><input type="number" min="0" step="any" [ngModel]="qty()[r.productId] ?? ''" (ngModelChange)="setQty(r.productId, $event)" [attr.aria-label]="'Contado de ' + r.productName" /></td></tr>
              } @empty { <tr><td colspan="3" class="state">{{ rows.isLoading() ? 'Cargando…' : 'No hay productos que controlen existencias.' }}</td></tr> }
            </tbody>
          </table>
        </div>
        <p class="small muted">Solo se ajustan los productos con cantidad escrita. Deja vacío lo que no contaste.</p>
        <p class="err small" role="alert">{{ action.error() }}</p>
        <button type="button" class="primary" (click)="saveCount()" [disabled]="!filledLines().length || action.busy()">Registrar conteo ({{ filledLines().length }})</button>
      }
    }

    @if (countResult(); as res) {
      <app-modal title="Conteo registrado" eyebrow="Conteo físico" (closed)="countResult.set(null)">
        <table>
          <thead><tr><th>Producto</th><th class="num">Antes</th><th class="num">Contado</th><th class="num">Ajuste</th></tr></thead>
          <tbody>@for (l of res; track l.productId) {
            <tr><td>{{ l.productName }}</td><td class="num">{{ l.previous | number: '1.0-4' }}</td><td class="num">{{ l.counted | number: '1.0-4' }}</td>
              <td class="num" [class.pos]="l.difference > 0" [class.neg]="l.difference < 0">{{ l.difference > 0 ? '+' : '' }}{{ l.difference | number: '1.0-4' }}</td></tr>
          }</tbody>
        </table>
        <div class="actions"><button type="button" class="primary" (click)="countResult.set(null)">Listo</button></div>
      </app-modal>
    }
  `,
})
export class AdjustmentsPage {
  private readonly bo = inject(BackofficeApi);
  protected readonly action = new AsyncAction(inject(ToastService));
  protected readonly tab = signal<Tab>('ajuste');
  protected readonly branchId = signal('');
  protected readonly locationId = signal('');
  protected readonly q = signal('');
  /** Cantidades escritas en las tablas de inicial y conteo, por producto. */
  protected readonly qty = signal<Record<string, number | null>>({});
  protected readonly countResult = signal<CountResultLine[] | null>(null);

  protected readonly branches = resource({ loader: () => this.bo.branches() });
  protected readonly activeBranches = computed(() => (this.branches.value() ?? []).filter((b) => b.isActive));
  protected readonly locations = resource({
    params: () => this.branchId() || undefined,
    loader: ({ params: id }) => this.bo.stockLocations(id),
  });
  protected readonly reasons = resource({ loader: () => this.bo.adjustmentReasons() });
  protected readonly rows = resource({
    params: () => (this.branchId() && this.locationId() ? { branchId: this.branchId(), locationId: this.locationId(), search: this.q().trim() } : undefined),
    loader: ({ params }) => this.bo.stock({ ...params, pageSize: ROWS }),
  });
  protected readonly withoutInitial = computed(() => (this.rows.value()?.items ?? []).filter((r) => !r.hasMovements));
  protected readonly filledLines = computed(() => {
    const visible = new Set((this.tab() === 'inicial' ? this.withoutInitial() : (this.rows.value()?.items ?? [])).map((r: StockRowDto) => r.productId));
    return Object.entries(this.qty())
      .filter(([id, v]) => visible.has(id) && v !== null && `${v}` !== '' && Number(v) >= 0 && (this.tab() === 'conteo' || Number(v) > 0))
      .map(([productId, v]) => ({ productId, value: Number(v) }));
  });

  protected readonly adjust = inject(FormBuilder).nonNullable.group({
    productId: ['', Validators.required],
    direction: ['out' as 'in' | 'out'],
    quantity: [0, [Validators.required, Validators.min(0.0001)]],
    reasonId: ['', Validators.required],
    note: [''],
  });

  /** Clave del intento en curso: se renueva al cambiar los datos o al registrar con éxito. */
  private key = newIdempotencyKey();

  constructor() {
    effect(() => {
      const first = this.activeBranches()[0];
      if (first && !this.branchId()) this.branchId.set(first.id);
    });
    effect(() => {
      const locations = this.locations.value() ?? [];
      if (locations.length && !locations.some((l) => l.id === this.locationId()))
        this.locationId.set((locations.find((l) => l.isDefault) ?? locations[0]).id);
    });
    // Cambiar de pestaña o de ubicación empieza un intento nuevo.
    effect(() => {
      this.tab();
      this.locationId();
      this.qty.set({});
      this.action.error.set('');
      this.key = newIdempotencyKey();
    });
    this.adjust.valueChanges.subscribe(() => (this.key = newIdempotencyKey()));
    this.adjust.controls.direction.valueChanges.subscribe(() => this.adjust.controls.reasonId.setValue(''));
  }

  protected reasonsFor(direction: 'in' | 'out') {
    return (this.reasons.value() ?? []).filter((r) => r.isActive && (r.direction === direction || r.direction === 'both') && r.code !== 'CONTEO');
  }

  protected setQty(productId: string, value: number | null): void {
    this.qty.update((q) => ({ ...q, [productId]: value }));
    this.key = newIdempotencyKey();
  }

  protected errorOf(e: unknown): string {
    return (e as Error)?.message ?? 'No se pudieron cargar los productos.';
  }

  protected async saveAdjustment(): Promise<void> {
    const v = this.adjust.getRawValue();
    const quantity = Number(v.quantity) * (v.direction === 'out' ? -1 : 1);
    const done = await this.action.run(() => this.bo.registerAdjustment({
      locationId: this.locationId(), productId: v.productId, quantity, reasonId: v.reasonId, note: v.note.trim() || null,
    }, this.key), 'Ajuste registrado');
    if (!done) return;
    this.adjust.reset({ productId: '', direction: v.direction, quantity: 0, reasonId: '', note: '' });
    this.key = newIdempotencyKey();
    this.rows.reload();
  }

  protected async saveInitial(): Promise<void> {
    const lines = this.filledLines().map((l) => ({ productId: l.productId, quantity: l.value }));
    const done = await this.action.run(() => this.bo.registerInitialStock({ locationId: this.locationId(), lines, note: null }, this.key),
      `Existencia inicial de ${lines.length} productos registrada`);
    if (!done) return;
    this.qty.set({});
    this.key = newIdempotencyKey();
    this.rows.reload();
  }

  protected async saveCount(): Promise<void> {
    const lines = this.filledLines().map((l) => ({ productId: l.productId, counted: l.value }));
    const result = await this.action.run(() => this.bo.registerCount({ locationId: this.locationId(), lines, note: null }, this.key), 'Conteo registrado');
    if (!result) return;
    this.qty.set({});
    this.key = newIdempotencyKey();
    this.countResult.set(result);
    this.rows.reload();
  }
}
