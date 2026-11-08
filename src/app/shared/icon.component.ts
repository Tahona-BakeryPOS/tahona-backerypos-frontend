import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Íconos de línea (24×24, trazo) para la navegación. Heredan el color del texto. */
const PATHS: Record<string, string> = {
  panel: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  store: 'M4 10v10h16V10M3 10l2-6h14l2 6M3 10h18M9 20v-6h6v6',
  box: 'M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8',
  chef: 'M7 14h10v6H7zM6 14a4 4 0 1 1 2-7.5 4 4 0 0 1 8 0A4 4 0 1 1 18 14',
  truck: 'M3 6h11v10H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  register: 'M4 11h16v9H4zM7 11V5h10v6M8 15h2M14 15h2M10 8h4',
  chart: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15l1.6 2-2 3.4-2.4-.8a7 7 0 0 1-2.2 1.3L14 23h-4l-.4-2.1a7 7 0 0 1-2.2-1.3l-2.4.8-2-3.4L4.6 15a7 7 0 0 1 0-2.6L3 10.4l2-3.4 2.4.8A7 7 0 0 1 9.6 6.5L10 4h4l.4 2.5a7 7 0 0 1 2.2 1.3l2.4-.8 2 3.4-1.6 2a7 7 0 0 1 0 2.6z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 6l12 12M18 6L6 18',
  back: 'M15 6l-6 6 6 6',
};

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', style: 'display:inline-flex' },
  template: `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round"><path [attr.d]="d()" /></svg>
  `,
})
export class IconComponent {
  readonly name = input.required<string>();
  protected readonly d = computed(() => PATHS[this.name()] ?? '');
}
