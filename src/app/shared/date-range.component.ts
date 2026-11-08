import { ChangeDetectionStrategy, Component, model } from '@angular/core';

/** Fecha local en formato yyyy-MM-dd (lo que esperan los filtros de la API). */
export const isoDate = (d: Date): string =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

export const daysAgo = (n: number): string => isoDate(new Date(Date.now() - n * 86_400_000));

/** Filtro de rango de fechas con atajos (Hoy, 7 días, 30 días). */
@Component({
  selector: 'app-date-range',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end; }
    label { display: grid; gap: 4px; font-size: 13px; color: var(--muted); }
    input { min-height: 40px; width: auto; }
    button { min-height: 40px; }
  `,
  template: `
    <label>Desde <input type="date" [value]="from()" (change)="from.set($any($event.target).value)" [max]="to()" /></label>
    <label>Hasta <input type="date" [value]="to()" (change)="to.set($any($event.target).value)" [min]="from()" /></label>
    <button type="button" class="sm" (click)="preset(0)">Hoy</button>
    <button type="button" class="sm" (click)="preset(6)">7 días</button>
    <button type="button" class="sm" (click)="preset(29)">30 días</button>
  `,
})
export class DateRangeComponent {
  readonly from = model.required<string>();
  readonly to = model.required<string>();

  protected preset(days: number): void {
    this.from.set(daysAgo(days));
    this.to.set(daysAgo(0));
  }
}
