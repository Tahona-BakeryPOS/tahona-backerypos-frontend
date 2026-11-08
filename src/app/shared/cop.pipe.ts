import { Pipe, PipeTransform } from '@angular/core';

const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const formatCop = (n: number | null | undefined): string => fmt.format(n ?? 0).replace(/\s/g, '');

/** Pesos colombianos: $12.500 (decimales solo si existen, como los impuestos). */
@Pipe({ name: 'cop' })
export class CopPipe implements PipeTransform {
  transform(n: number | null | undefined): string {
    return formatCop(n);
  }
}
