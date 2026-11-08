import { ChangeDetectionStrategy, Component, inject, resource } from '@angular/core';
import { BackofficeApi } from '../../../core/api/backoffice-api';
import { PERMISSION_LABELS } from '../../../core/auth/permissions';
import { BO_PAGE_STYLES } from '../backoffice.styles';

/** Configuración → Roles: qué puede hacer cada rol (solo lectura en el MVP). */
@Component({
  selector: 'app-roles-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [BO_PAGE_STYLES, `.perms { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }`],
  template: `
    <div class="head"><div><h1>Roles</h1><p>Propietario, Administrador de sucursal y Cajero vienen definidos. Editar permisos llegará en una próxima versión.</p></div></div>
    <div class="grid-2">
      @for (r of roles.value() ?? []; track r.id) {
        <section class="card pad">
          <h2>{{ r.name }}@if (r.isSystem) { <span class="small muted"> · del sistema</span> }</h2>
          <div class="perms">@for (p of r.permissions; track p) { <span class="badge" [title]="p">{{ label(p) }}</span> } @empty { <span class="small muted">Sin permisos</span> }</div>
        </section>
      } @empty { <p class="state">{{ roles.isLoading() ? 'Cargando…' : 'Sin roles.' }}</p> }
    </div>
  `,
})
export class RolesPage {
  private readonly bo = inject(BackofficeApi);
  protected readonly roles = resource({ loader: () => this.bo.roles() });

  protected label(code: string): string {
    return PERMISSION_LABELS[code] ?? code;
  }
}
