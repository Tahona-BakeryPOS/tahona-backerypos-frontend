/**
 * Sale money rules: they replicate the backend's SaleLine.Create to show the total while the
 * cashier builds the sale. The total that is charged is always the one the server returns (POST /ventas).
 * With a price that includes tax (D-07): gross = quantity × price − discount; base = gross / (1 + rate);
 * tax = gross − base. If it does not include it: base = gross; tax = base × rate.
 * Pure functions: they are tested without Angular.
 */

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface LineInput {
  quantity: number;
  unitPrice: number;
  priceIncludesTax: boolean;
  /** Discount in money (with the same tax criterion as the price). */
  discountAmount: number;
  taxRate: number;
}

export interface LineAmounts {
  /** Base gravable. */
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

export function lineAmounts(l: LineInput): LineAmounts {
  const gross = round2(round2(l.quantity * l.unitPrice) - l.discountAmount);
  if (l.priceIncludesTax) {
    const base = round2(gross / (1 + l.taxRate / 100));
    return { subtotal: base, discount: l.discountAmount, tax: round2(gross - base), total: gross };
  }
  const tax = round2(gross * (l.taxRate / 100));
  return { subtotal: gross, discount: l.discountAmount, tax, total: round2(gross + tax) };
}

export function saleAmounts(lines: LineInput[]): LineAmounts {
  return lines.map(lineAmounts).reduce(
    (a, x) => ({
      subtotal: round2(a.subtotal + x.subtotal), discount: round2(a.discount + x.discount),
      tax: round2(a.tax + x.tax), total: round2(a.total + x.total),
    }),
    { subtotal: 0, discount: 0, tax: 0, total: 0 },
  );
}
