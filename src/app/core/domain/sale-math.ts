/**
 * Reglas de dinero de la venta: replican SaleLine.Create del backend para mostrar el total mientras el
 * cajero arma la venta. El total que se cobra siempre es el que devuelve el servidor (POST /ventas).
 * Con precio que incluye impuesto (D-07): bruto = cantidad × precio − descuento; base = bruto / (1 + tarifa);
 * impuesto = bruto − base. Si no lo incluye: base = bruto; impuesto = base × tarifa.
 * Funciones puras: se prueban sin Angular.
 */

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface LineInput {
  quantity: number;
  unitPrice: number;
  priceIncludesTax: boolean;
  /** Descuento en dinero (con el mismo criterio de impuesto que el precio). */
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
