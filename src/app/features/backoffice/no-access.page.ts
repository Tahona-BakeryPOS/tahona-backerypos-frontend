import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BO_PAGE_STYLES } from './backoffice.styles';

/**
 * Sesión de backoffice sin ninguna pantalla disponible todavía (p. ej. un rol con solo reportes:
 * los informes contra la API v2 llegan en su fase).
 */
@Component({
  selector: 'app-no-access-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: BO_PAGE_STYLES,
  template: `
    <div class="head"><div><h1>Nada por aquí todavía</h1>
      <p>Tu rol no tiene pantallas disponibles en esta versión del backoffice. Pídele al propietario que revise tus permisos.</p></div></div>
  `,
})
export class NoAccessPage {}
