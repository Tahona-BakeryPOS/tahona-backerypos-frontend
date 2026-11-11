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

/** The line's discount in money (what the API receives), from the chosen percentage. */
export const discountAmount = (l: CartLine): number => round2(round2(l.quantity * l.product.price) * (l.discountPercent / 100));

export const toLineInput = (l: CartLine): LineInput => ({
  quantity: l.quantity,
  unitPrice: l.product.price,
  priceIncludesTax: l.product.priceIncludesTax,
  discountAmount: discountAmount(l),
  taxRate: l.product.taxRate,
});

/**
 * Sale in progress at the register (memory only). The totals are a preview: when charging, the server
 * creates the sale with its current prices and that is the total that is charged.
 */
@Injectable({ providedIn: 'root' })
export class CartStore {
  private seq = 0;
  private readonly _lines = signal<CartLine[]>([]);
  private readonly _customer = signal<string | null>(null);

  readonly lines = this._lines.asReadonly();
  /** NIT or ID for the invoice with the customer's data; null = final consumer. */
  readonly customer = this._customer.asReadonly();
  readonly isEmpty = computed(() => this._lines().length === 0);
  readonly totals = computed(() => saleAmounts(this._lines().map(toLineInput)));

  add(product: PosProduct, quantity = 1): void {
    this._lines.update((ls) => {
      // Each weighing is its own line; units of the same product accumulate.
      const same = product.allowsDecimals ? undefined : ls.find((l) => l.product.id === product.id && l.discountPercent === 0);
      return same
        ? ls.map((l) => (l === same ? { ...l, quantity: l.quantity + quantity } : l))
        : [...ls, { key: ++this.seq, product, quantity: round2(quantity), discountPercent: 0, discountReason: null }];
    });
  }

  /** Adds or subtracts one step: 1 unit, or 0.25 for products sold by weight. */
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

  /** US-6.2: a discount requires a reason (and the sales.discount permission on the server). */
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
