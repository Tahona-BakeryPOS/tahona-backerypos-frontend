import { ChangeDetectionStrategy, Component, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BackofficeApi } from '../../../core/api/backoffice-api';
import { toApiError } from '../../../core/api/api-error';
import { BO_PAGE_STYLES } from '../backoffice.styles';

/**
 * Configuración → Numberings. With Siigo (D-04) the numbering and DIAN resolutions are kept by Siigo:
 * here its document types are shown (read-only); they are managed in Siigo Nube (I-24).
 */
@Component({
  selector: 'app-sequences-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: BO_PAGE_STYLES,
  template: `
    <div class="head"><div><h1>Numeraciones</h1><p>La numeración y las resoluciones DIAN las administra Siigo. Para cambiarlas usa Siigo Nube; aquí se consultan.</p></div></div>
    @if (catalogs.error(); as e) {
      <p class="err">{{ msg(e) }}</p>
      <p class="small">Configura primero la conexión en <a routerLink="/backoffice/settings/invoicing">Facturación electrónica</a>.</p>
    }
    @for (group of groups(); track group.title) {
      <h2 style="font-size:16px;margin-top:12px">{{ group.title }}</h2>
      <div class="card scroll-x" style="max-width:820px">
        <table>
          <thead><tr><th>Id</th><th>Código</th><th>Nombre</th><th>Prefijo · tipo electrónico</th><th>Estado</th></tr></thead>
          <tbody>
            @for (t of group.items; track t.id) {
              <tr><td><code>{{ t.id }}</code></td><td>{{ t.code ?? '—' }}</td><td>{{ t.name }}</td><td>{{ t.detail ?? '—' }}</td>
                <td><span class="badge" [class.ok]="t.active">{{ t.active ? 'activo' : 'inactivo' }}</span></td></tr>
            } @empty { <tr><td colspan="5" class="state">Sin comprobantes.</td></tr> }
          </tbody>
        </table>
      </div>
    } @empty { @if (catalogs.isLoading()) { <p class="state">Consultando Siigo…</p> } }
  `,
})
export class SequencesPage {
  private readonly bo = inject(BackofficeApi);
  protected readonly catalogs = resource({ loader: () => this.bo.siigoCatalogs() });

  protected groups() {
    const c = this.catalogs.value();
    return c ? [{ title: 'Facturas de venta (FV)', items: c.invoiceTypes }, { title: 'Notas crédito (NC)', items: c.creditNoteTypes }] : [];
  }

  protected msg(e: unknown): string {
    return toApiError(e).message;
  }
}
