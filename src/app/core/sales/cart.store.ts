import { Injectable, computed, signal } from '@angular/core';
import { PosProduct } from '../api/api.models';
import { LineInput, lineAmounts, round2, saleAmounts } from '../domain/sale-math';

export interface CartLine {
  key: number;
  product: PosProduct;
  quantity: number;
  discountPercent: number;
  discountReason: string | null;
}

/** Descuento en dinero de la línea (lo que recibe la API), a partir del porcentaje elegido. */
export const discountAmount = (l: CartLine): number => round2(round2(l.quantity * l.product.price) * (l.discountPercent / 100));

export const toLineInput = (l: CartLine): LineInput => ({
  quantity: l.quantity,
  unitPrice: l.product.price,
  priceIncludesTax: l.product.priceIncludesTax,
  discountAmount: discountAmount(l),
  taxRate: l.product.taxRate,
});

/**
 * Venta en curso en la caja (solo en memoria). Los totales son una vista previa: al cobrar, el servidor
 * crea la venta con sus precios vigentes y ese es el total que se cobra.
 */
@Injectable({ providedIn: 'root' })
export class CartStore {
  private seq = 0;
  private readonly _lines = signal<CartLine[]>([]);
  private readonly _customer = signal<string | null>(null);

  readonly lines = this._lines.asReadonly();
  /** NIT o cédula para la factura con datos del cliente; null = consumidor final. */
  readonly customer = this._customer.asReadonly();
  readonly isEmpty = computed(() => this._lines().length === 0);
  readonly totals = computed(() => saleAmounts(this._lines().map(toLineInput)));

  add(product: PosProduct, quantity = 1): void {
    this._lines.update((ls) => {
      // Cada pesada es una línea propia; las unidades del mismo producto se acumulan.
      const same = product.allowsDecimals ? undefined : ls.find((l) => l.product.id === product.id && l.discountPercent === 0);
      return same
        ? ls.map((l) => (l === same ? { ...l, quantity: l.quantity + quantity } : l))
        : [...ls, { key: ++this.seq, product, quantity: round2(quantity), discountPercent: 0, discountReason: null }];
    });
  }

  /** Suma o resta un paso: 1 unidad, o 0,25 en productos por peso. */
  step(key: number, direction: 1 | -1): void {
    this._lines.update((ls) =>
      ls
        .map((l) => (l.key !== key ? l : { ...l, quantity: round2(l.quantity + direction * (l.product.allowsDecimals ? 0.25 : 1)) }))
        .filter((l) => l.quantity > 0),
    );
  }

  remove(key: number): void {
    this._lines.update((ls) => ls.filter((l) => l.key !== key));
  }

  /** HU-6.2: el descuento exige motivo (y el permiso ventas.descuento en el servidor). */
  discount(key: number, percent: number, reason: string): void {
    this._lines.update((ls) => ls.map((l) => (l.key === key ? { ...l, discountPercent: percent, discountReason: percent ? reason : null } : l)));
  }

  setCustomer(identification: string | null): void {
    this._customer.set(identification?.trim() || null);
  }

  lineTotal(l: CartLine): number {
    return lineAmounts(toLineInput(l)).total;
  }

  clear(): void {
    this._lines.set([]);
    this._customer.set(null);
  }
}
