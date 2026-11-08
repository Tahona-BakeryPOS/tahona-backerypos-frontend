import { describe, expect, it } from 'vitest';
import { lineAmounts, saleAmounts } from './sale-math';

describe('sale-math (mismas reglas que SaleLine del backend)', () => {
  it('precio con IVA incluido: separa base e impuesto (D-07)', () => {
    expect(lineAmounts({ quantity: 2, unitPrice: 5950, priceIncludesTax: true, discountAmount: 0, taxRate: 19 })).toEqual({
      subtotal: 10000, discount: 0, tax: 1900, total: 11900,
    });
  });

  it('precio sin IVA: el impuesto se suma sobre la base con descuento', () => {
    expect(lineAmounts({ quantity: 1, unitPrice: 1000, priceIncludesTax: false, discountAmount: 100, taxRate: 19 })).toEqual({
      subtotal: 900, discount: 100, tax: 171, total: 1071,
    });
  });

  it('suma las líneas de la venta', () => {
    const t = saleAmounts([
      { quantity: 1, unitPrice: 2380, priceIncludesTax: true, discountAmount: 0, taxRate: 19 },
      { quantity: 0.5, unitPrice: 38000, priceIncludesTax: true, discountAmount: 0, taxRate: 0 },
    ]);
    expect(t).toEqual({ subtotal: 21000, discount: 0, tax: 380, total: 21380 });
  });
});
