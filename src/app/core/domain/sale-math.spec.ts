import { describe, expect, it } from 'vitest';
import { lineAmounts, saleAmounts } from './sale-math';

describe('sale-math (same rules as the backend SaleLine)', () => {
  it('price with VAT included: splits base and tax (D-07)', () => {
    expect(lineAmounts({ quantity: 2, unitPrice: 5950, priceIncludesTax: true, discountAmount: 0, taxRate: 19 })).toEqual({
      subtotal: 10000, discount: 0, tax: 1900, total: 11900,
    });
  });

  it('price without VAT: the tax is added on top of the discounted base', () => {
    expect(lineAmounts({ quantity: 1, unitPrice: 1000, priceIncludesTax: false, discountAmount: 100, taxRate: 19 })).toEqual({
      subtotal: 900, discount: 100, tax: 171, total: 1071,
    });
  });

  it('adds up the sale lines', () => {
    const t = saleAmounts([
      { quantity: 1, unitPrice: 2380, priceIncludesTax: true, discountAmount: 0, taxRate: 19 },
      { quantity: 0.5, unitPrice: 38000, priceIncludesTax: true, discountAmount: 0, taxRate: 0 },
    ]);
    expect(t).toEqual({ subtotal: 21000, discount: 0, tax: 380, total: 21380 });
  });
});
