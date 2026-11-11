import { ChangeDetectionStrategy, Component, effect, inject, resource, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { newIdempotencyKey } from '../../../core/api/api-client';
import { FiscalDocumentDto, SiigoCatalogsDto } from '../../../core/api/api.models';
import { BackofficeApi } from '../../../core/api/backoffice-api';
import { AsyncAction } from '../../../shared/async-action';
import { CopPipe } from '../../../shared/cop.pipe';
import { ToastService } from '../../../shared/toast.service';
import { BO_PAGE_STYLES } from '../backoffice.styles';

/**
 * Configuración → Electronic invoicing with Siigo (D-04, D-17: optional per company). The user and
 * access key are stored encrypted and are not shown again. Taxes and payment methods are
 * paired with Siigo's; products are created in Siigo with their SKU when they are invoiced (I-24).
 */
@Component({
  selector: 'app-invoicing-page',
  imports: [ReactiveFormsModule, FormsModule, CopPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [BO_PAGE_STYLES, `
    td select { min-height: 36px; }
    .checks label { display: flex; gap: 8px; align-items: center; font-size: 14px; }
    .checks input { width: auto; min-height: auto; }
  `],
  template: `
    <div class="head"><div><h1>Facturación electrónica</h1>
      <p>La facturación electrónica es opcional y se enciende o apaga por empresa. Encendida, cada venta se factura con Siigo, con los datos del cliente o como consumidor final. Apagada, las ventas se registran sin factura. Confirma con tu contador si estás obligado a facturar.</p></div></div>
    <div class="grid-2">
      <form class="card pad" [formGroup]="form" (ngSubmit)="save()">
        <h2>Conexión con Siigo</h2>
        <p class="small">@if (settings.value(); as s) {
          Credenciales {{ s.hasCredentials ? 'guardadas' : 'sin configurar' }} · <span class="badge" [class.ok]="s.isActive">{{ s.isActive ? 'activa' : 'inactiva' }}</span>
        }</p>
        <div class="two">
          <div class="field"><label for="fUser">Usuario API (vacío = conservar)</label><input id="fUser" autocomplete="off" formControlName="username" /></div>
          <div class="field"><label for="fKey">Llave de acceso (vacío = conservar)</label><input id="fKey" type="password" autocomplete="off" formControlName="accessKey" /></div>
        </div>
        <div class="row" style="margin-bottom:8px"><button type="button" class="sm" (click)="loadCatalogs()" [disabled]="catalogAction.busy()">Consultar catálogos de Siigo</button></div>
        <p class="err small" role="alert">{{ catalogAction.error() }}</p>
        <div class="field"><label for="fFv">Comprobante de factura electrónica (FV)</label>
          <select id="fFv" formControlName="invoiceDocumentTypeId"><option [ngValue]="null">— elegir —</option>
            @for (t of catalogs()?.invoiceTypes ?? []; track t.id) { <option [ngValue]="+t.id">{{ t.name }} · {{ t.detail }}</option> }
            @if (!catalogs() && form.controls.invoiceDocumentTypeId.value) { <option [ngValue]="form.controls.invoiceDocumentTypeId.value">Id {{ form.controls.invoiceDocumentTypeId.value }}</option> }
          </select></div>
        <div class="field"><label for="fNc">Comprobante de nota crédito (NC, devoluciones)</label>
          <select id="fNc" formControlName="creditNoteDocumentTypeId"><option [ngValue]="null">— ninguno —</option>
            @for (t of catalogs()?.creditNoteTypes ?? []; track t.id) { <option [ngValue]="+t.id">{{ t.name }} · {{ t.detail }}</option> }
            @if (!catalogs() && form.controls.creditNoteDocumentTypeId.value) { <option [ngValue]="form.controls.creditNoteDocumentTypeId.value">Id {{ form.controls.creditNoteDocumentTypeId.value }}</option> }
          </select></div>
        <div class="two">
          <div class="field"><label for="fSeller">Vendedor en Siigo</label>
            <select id="fSeller" formControlName="sellerId"><option [ngValue]="null">— elegir —</option>
              @for (u of catalogs()?.users ?? []; track u.id) { <option [ngValue]="+u.id">{{ u.name || u.code }}</option> }
              @if (!catalogs() && form.controls.sellerId.value) { <option [ngValue]="form.controls.sellerId.value">Id {{ form.controls.sellerId.value }}</option> }
            </select></div>
          <div class="field"><label for="fGroup">Grupo de inventario (id en Siigo)</label><input id="fGroup" type="number" min="1" formControlName="productAccountGroupId" /></div>
        </div>
        <div class="two">
          <div class="field"><label for="fCf">Identificación del consumidor final</label><input id="fCf" inputmode="numeric" formControlName="consumerFinalIdentification" /></div>
          <div class="field"><label for="fRet">Conservar documentos (años)</label><input id="fRet" type="number" min="1" max="50" formControlName="retentionYears" /></div>
        </div>
        <label class="row small"><input type="checkbox" formControlName="activate" style="width:auto;min-height:auto" /> Facturar electrónicamente las ventas (para encenderla se exige todo lo anterior)</label>
        <p class="small muted">Si la apagas, las ventas nuevas quedan sin factura; las facturas y notas crédito que ya estaban en trámite se terminan de enviar. Los cobros con Bold no dependen de este interruptor.El consumidor final y los clientes con NIT deben existir en Siigo. Los productos se crean allí con su SKU la primera vez que se facturan.</p>
        <p class="err small" role="alert">{{ action.error() }}</p>
        <button type="submit" class="primary" [disabled]="form.invalid || action.busy()">Guardar</button>
      </form>

      <section class="card pad">
        <h2>Emparejar con Siigo</h2>
        @if (!catalogs()) { <p class="small muted">Consulta los catálogos de Siigo para emparejar.</p> }
        <h3 style="font-size:15px">Impuestos</h3>
        <table>
          <tbody>
            @for (t of taxes.value() ?? []; track t.id) {
              <tr><td>{{ t.name }}</td><td>
                <select [ngModel]="map()['tax:' + t.id] ?? ''" (ngModelChange)="setMap('tax', t.id, $event)" [disabled]="!catalogs()" [attr.aria-label]="'Siigo para ' + t.name">
                  <option value="">— sin emparejar —</option>
                  @for (s of catalogs()?.taxes ?? []; track s.id) { <option [value]="s.id">{{ s.name }} {{ s.detail ? '(' + s.detail + '%)' : '' }}</option> }
                  @if (!catalogs() && map()['tax:' + t.id]) { <option [value]="map()['tax:' + t.id]">Id {{ map()['tax:' + t.id] }}</option> }
                </select></td></tr>
            }
          </tbody>
        </table>
        <h3 style="font-size:15px;margin-top:12px">Medios de pago</h3>
        <table>
          <tbody>
            @for (m of methods.value() ?? []; track m.id) {
              <tr><td>{{ m.name }}</td><td>
                <select [ngModel]="map()['payment_method:' + m.id] ?? ''" (ngModelChange)="setMap('payment_method', m.id, $event)" [disabled]="!catalogs()" [attr.aria-label]="'Siigo para ' + m.name">
                  <option value="">— sin emparejar —</option>
                  @for (s of catalogs()?.paymentTypes ?? []; track s.id) { <option [value]="s.id">{{ s.name }}</option> }
                  @if (!catalogs() && map()['payment_method:' + m.id]) { <option [value]="map()['payment_method:' + m.id]">Id {{ map()['payment_method:' + m.id] }}</option> }
                </select></td></tr>
            }
          </tbody>
        </table>
        <p class="err small" role="alert">{{ mapAction.error() }}</p>
        <button type="button" class="primary" style="margin-top:8px" (click)="saveMappings()" [disabled]="mapAction.busy() || !catalogs()">Guardar emparejamientos</button>
      </section>

      <section class="card pad">
        <h2>Factura de prueba</h2>
        <p class="small warn">Se envía a la DIAN en el ambiente de tu empresa en Siigo. Úsala solo si la empresa está en habilitación (pruebas).</p>
        <form [formGroup]="test" (ngSubmit)="sendTest()">
          <div class="field"><label for="tProduct">Producto</label>
            <select id="tProduct" formControlName="productId"><option value="">— elegir —</option>
              @for (p of products.value()?.items ?? []; track p.id) { @if (p.price !== null) { <option [value]="p.id">{{ p.name }} · {{ p.price | cop }}</option> } }
            </select></div>
          <div class="two">
            <div class="field"><label for="tQty">Cantidad</label><input id="tQty" type="number" min="0.01" step="0.01" formControlName="quantity" /></div>
            <div class="field"><label for="tPay">Medio de pago</label>
              <select id="tPay" formControlName="paymentMethodId"><option value="">— elegir —</option>
                @for (m of methods.value() ?? []; track m.id) { <option [value]="m.id">{{ m.name }}</option> }</select></div>
          </div>
          <div class="checks"><label><input type="checkbox" formControlName="confirm" /> La empresa en Siigo está en habilitación (pruebas)</label></div>
          <p class="err small" role="alert">{{ testAction.error() }}</p>
          <button type="submit" class="primary" [disabled]="test.invalid || !test.controls.confirm.value || testAction.busy()">Enviar factura de prueba</button>
        </form>
        @if (testDoc(); as d) {
          <p class="small" style="margin-top:8px">Documento creado ({{ d.status }}). Sigue su resultado en Ventas y caja → Facturas electrónicas.</p>
        }
      </section>
    </div>
  `,
})
export class InvoicingPage {
  private readonly bo = inject(BackofficeApi);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly toast = inject(ToastService);
  protected readonly action = new AsyncAction(this.toast);
  protected readonly catalogAction = new AsyncAction(this.toast);
  protected readonly mapAction = new AsyncAction(this.toast);
  protected readonly testAction = new AsyncAction(this.toast);

  protected readonly settings = resource({ loader: () => this.bo.fiscalSettings() });
  protected readonly taxes = resource({ loader: () => this.bo.taxes() });
  protected readonly methods = resource({ loader: () => this.bo.paymentMethods() });
  protected readonly products = resource({ loader: () => this.bo.products({ pageSize: 200 }) });
  protected readonly catalogs = signal<SiigoCatalogsDto | null>(null);
  /** "type:localId" → id in Siigo. */
  protected readonly map = signal<Record<string, string>>({});
  protected readonly testDoc = signal<FiscalDocumentDto | null>(null);

  protected readonly form = this.fb.group({
    username: [''],
    accessKey: [''],
    invoiceDocumentTypeId: [null as number | null],
    creditNoteDocumentTypeId: [null as number | null],
    sellerId: [null as number | null],
    productAccountGroupId: [null as number | null],
    consumerFinalIdentification: ['222222222222', [Validators.required, Validators.pattern(/^\d+$/)]],
    retentionYears: [5, [Validators.required, Validators.min(1), Validators.max(50)]],
    activate: [false],
  });
  protected readonly test = this.fb.group({
    productId: ['', Validators.required],
    quantity: [1, [Validators.required, Validators.min(0.01)]],
    paymentMethodId: ['', Validators.required],
    confirm: [false],
  });
  private testKey = newIdempotencyKey();

  constructor() {
    effect(() => {
      const s = this.settings.value();
      if (s) this.form.reset({
        username: '', accessKey: '', invoiceDocumentTypeId: s.invoiceDocumentTypeId, creditNoteDocumentTypeId: s.creditNoteDocumentTypeId,
        sellerId: s.sellerId, productAccountGroupId: s.productAccountGroupId, consumerFinalIdentification: s.consumerFinalIdentification,
        retentionYears: s.retentionYears, activate: s.isActive,
      });
    });
    void this.bo.fiscalMappings().then((list) => this.map.set(Object.fromEntries(list.map((m) => [`${m.kind}:${m.localId}`, m.externalId])))).catch(() => undefined);
    this.test.valueChanges.subscribe(() => (this.testKey = newIdempotencyKey()));
  }

  protected async save(): Promise<void> {
    const v = this.form.getRawValue();
    const saved = await this.action.run(() => this.bo.saveFiscalSettings({
      username: v.username.trim() || null, accessKey: v.accessKey.trim() || null,
      invoiceDocumentTypeId: v.invoiceDocumentTypeId, creditNoteDocumentTypeId: v.creditNoteDocumentTypeId, sellerId: v.sellerId,
      productAccountGroupId: v.productAccountGroupId ? Number(v.productAccountGroupId) : null,
      consumerFinalIdentification: v.consumerFinalIdentification.trim(), retentionYears: Number(v.retentionYears), activate: v.activate,
    }), 'Configuración guardada');
    // The typed credentials are not kept in the form.
    this.form.patchValue({ username: '', accessKey: '' });
    if (saved) this.settings.reload();
  }

  protected async loadCatalogs(): Promise<void> {
    const c = await this.catalogAction.run(() => this.bo.siigoCatalogs());
    if (c) this.catalogs.set(c);
  }

  protected setMap(kind: 'tax' | 'payment_method', localId: string, externalId: string): void {
    this.map.update((m) => ({ ...m, [`${kind}:${localId}`]: externalId }));
  }

  protected async saveMappings(): Promise<void> {
    const mappings = Object.entries(this.map()).filter(([, ext]) => ext)
      .map(([key, externalId]) => {
        const [kind, localId] = key.split(':') as ['tax' | 'payment_method', string];
        return { kind, localId, externalId };
      });
    await this.mapAction.run(() => this.bo.saveFiscalMappings(mappings), 'Emparejamientos guardados');
  }

  protected async sendTest(): Promise<void> {
    const v = this.test.getRawValue();
    const doc = await this.testAction.run(() => this.bo.testInvoice({
      productId: v.productId, quantity: Number(v.quantity), paymentMethodId: v.paymentMethodId, confirmTestEnvironment: v.confirm,
    }, this.testKey), 'Factura de prueba encolada');
    if (doc) { this.testKey = newIdempotencyKey(); this.testDoc.set(doc); }
  }
}
