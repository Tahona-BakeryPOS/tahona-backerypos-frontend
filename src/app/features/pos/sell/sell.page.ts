import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogStore } from '../../../core/catalog/catalog.store';
import { PosProduct } from '../../../core/api/api.models';
import { CartStore } from '../../../core/sales/cart.store';
import { CopPipe } from '../../../shared/cop.pipe';
import { ToastService } from '../../../shared/toast.service';
import { productEmoji } from './product-emoji';
import { TicketComponent } from './ticket.component';
import { WeightDialog } from './weight.dialog';

/** HU-6.1: pantalla de venta. Categorías y búsqueda a la izquierda, ticket a la derecha; precios vigentes de la sucursal. */
@Component({
  selector: 'app-sell-page',
  imports: [FormsModule, CopPipe, TicketComponent, WeightDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host { flex: 1; display: grid; grid-template-columns: minmax(0, 1fr) 380px; min-height: 0; }
    .catalog { display: flex; flex-direction: column; min-height: 0; min-width: 0; gap: 10px; padding: 12px max(12px, env(safe-area-inset-left, 0px)); }
    .chips { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; }
    .chips button { min-height: 42px; border-radius: 99px; white-space: nowrap; }
    .chips button.active { background: var(--text); color: var(--bg); border-color: var(--text); }
    .grid { flex: 1; overflow: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; align-content: start; }
    .prod { display: flex; flex-direction: column; justify-content: space-between; align-items: flex-start; text-align: left; padding: 10px; min-height: 104px; border-radius: 14px; }
    .emoji { font-size: 30px; line-height: 1; }
    .nm { font-weight: 600; font-size: 14px; line-height: 1.2; }
    .pr { color: var(--brand); font-weight: 800; font-variant-numeric: tabular-nums; }
    @media (max-width: 900px) { :host { grid-template-columns: 1fr; grid-template-rows: minmax(0, 1fr) 48%; } }
  `,
  template: `
    <section class="catalog" aria-label="Catálogo">
      <input type="search" placeholder="🔍 Buscar o escanear código de barras y Enter…" aria-label="Buscar producto"
             [ngModel]="query()" (ngModelChange)="query.set($event)" (keyup.enter)="scan()" />
      <div class="chips" role="tablist">
        <button type="button" role="tab" [class.active]="!category()" [attr.aria-selected]="!category()" (click)="category.set(null)">Todo</button>
        @for (c of catalog.categories(); track c) {
          <button type="button" role="tab" [class.active]="category() === c" [attr.aria-selected]="category() === c" (click)="category.set(c)">{{ c }}</button>
        }
      </div>
      <div class="grid">
        @for (p of visible(); track p.id) {
          <button type="button" class="prod" (click)="add(p)" [attr.aria-label]="p.name + ', ' + (p.price | cop)">
            <span class="emoji" aria-hidden="true">{{ emoji(p) }}</span>
            <span class="nm">{{ p.name }}</span>
            <span class="pr">{{ p.price | cop }}@if (p.allowsDecimals) { /{{ p.unitCode }} }</span>
          </button>
        } @empty {
          <div class="empty" style="grid-column:1/-1">
            @if (catalog.loading()) { Cargando catálogo… }
            @else if (catalog.error(); as e) { No se pudo cargar el catálogo: {{ e }} <button type="button" class="sm" (click)="catalog.refresh()">Reintentar</button> }
            @else if (catalog.products().length) { Sin resultados para "{{ query() }}" }
            @else { No hay productos con precio disponibles en esta sucursal. }
          </div>
        }
      </div>
    </section>
    <app-ticket />
    @if (weighing(); as p) { <app-weight-dialog [product]="p" (closed)="weighing.set(null)" (weighed)="addWeighed(p, $event)" /> }
  `,
})
export class SellPage {
  protected readonly catalog = inject(CatalogStore);
  private readonly cart = inject(CartStore);
  private readonly toast = inject(ToastService);

  protected readonly query = signal('');
  protected readonly category = signal<string | null>(null);
  protected readonly emoji = productEmoji;
  protected readonly weighing = signal<PosProduct | null>(null);

  constructor() {
    void this.catalog.refresh();
  }

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const c = this.category();
    return this.catalog.products().filter(
      (p) => (!c || p.category === c) && (!q || `${p.name} ${p.sku} ${p.barcode ?? ''}`.toLowerCase().includes(q)),
    );
  });

  protected add(p: PosProduct): void {
    if (p.allowsDecimals) this.weighing.set(p);
    else this.cart.add(p);
  }

  protected addWeighed(p: PosProduct, kg: number): void {
    this.cart.add(p, kg);
    this.weighing.set(null);
  }

  /** Lector de código de barras: escribe el código y envía Enter. */
  protected scan(): void {
    const p = this.catalog.findByCode(this.query());
    if (p) {
      this.add(p);
      this.query.set('');
    } else if (this.visible().length === 1) {
      this.add(this.visible()[0]);
      this.query.set('');
    } else {
      this.toast.show('No hay un producto con ese código.');
    }
  }
}
