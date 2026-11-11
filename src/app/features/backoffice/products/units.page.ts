import { ChangeDetectionStrategy, Component, inject, resource } from '@angular/core';
import { BackofficeApi } from '../../../core/api/backoffice-api';
import { BO_PAGE_STYLES } from '../backoffice.styles';

const KIND: Record<string, string> = { count: 'Conteo', mass: 'Masa', volume: 'Volumen' };

/** Productos → Units: global catalog of units of measure (read-only). */
@Component({
  selector: 'app-units-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: BO_PAGE_STYLES,
  template: `
    <div class="head"><div><h1>Unidades de medida</h1><p>Catálogo común a todas las panaderías. Las de masa y volumen se venden con cantidad decimal: la caja pide el peso o la medida.</p></div></div>
    <div class="card scroll-x" style="max-width:720px">
      <table>
        <thead><tr><th>Código</th><th>Unidad</th><th>Tipo</th><th>Código DIAN</th><th>En caja</th></tr></thead>
        <tbody>
          @for (u of units.value() ?? []; track u.id) {
            <tr><td><code>{{ u.code }}</code></td><td>{{ u.name }}</td><td>{{ kind(u.kind) }}</td><td><code>{{ u.dianCode }}</code></td>
              <td>{{ u.allowsDecimals ? 'Pide la cantidad' : 'Por unidades' }}</td></tr>
          } @empty { <tr><td colspan="5" class="state">{{ units.isLoading() ? 'Cargando…' : 'Sin unidades.' }}</td></tr> }
        </tbody>
      </table>
    </div>
  `,
})
export class UnitsPage {
  private readonly bo = inject(BackofficeApi);
  protected readonly units = resource({ loader: () => this.bo.units() });

  protected kind(k: string): string {
    return KIND[k] ?? k;
  }
}
