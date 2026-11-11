import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, resource, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { newIdempotencyKey } from '../../../core/api/api-client';
import { BoldMethodStatus, BoldTerminal, GatewayAccountDto, PaymentDto } from '../../../core/api/api.models';
import { BackofficeApi } from '../../../core/api/backoffice-api';
import { AsyncAction } from '../../../shared/async-action';
import { CopPipe } from '../../../shared/cop.pipe';
import { ToastService } from '../../../shared/toast.service';
import { BO_PAGE_STYLES } from '../backoffice.styles';

type Env = 'sandbox' | 'production';

/** How often a test charge is polled and for how long. */
const POLL_MS = 3000;
const POLL_MAX = 60;

/**
 * Configuración → Integraciones: Bold (card-terminal API). The keys are typed here, stored encrypted and
 * never shown again. Each register has its card terminal. The test charge goes to the real card terminal of an open
 * register; in the sandbox the result depends on the amount (backend: docs/payment-integration.md §11).
 */
@Component({
  selector: 'app-integrations-page',
  imports: [ReactiveFormsModule, FormsModule, CopPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [BO_PAGE_STYLES, `
    .env { display: flex; gap: 8px; margin-bottom: 10px; }
    .env button.active { background: var(--brand); color: #fff; border-color: var(--brand); }
    code.url { display: block; padding: 8px 10px; background: var(--surface2); border-radius: 8px; overflow-wrap: anywhere; font-size: 13px; }
    .terminals td select { min-height: 36px; }
  `],
  template: `
    <div class="head"><div><h1>Integraciones</h1><p>Bold cobra en el datáfono de cada caja con tarjeta, Nequi o QR. El resultado llega por webhook firmado.</p></div></div>
    <div class="grid-2">
      <section class="card pad">
        <h2>Bold · llaves</h2>
        <div class="env">
          <button type="button" [class.active]="env() === 'sandbox'" (click)="selectEnv('sandbox')">Pruebas (sandbox)</button>
          <button type="button" [class.active]="env() === 'production'" (click)="selectEnv('production')">Producción</button>
        </div>
        <p class="small">
          @if (current(); as a) {
            Llave de identidad {{ a.hasIdentityKey ? 'guardada' : 'falta' }} · llave secreta {{ a.hasSecretKey ? 'guardada' : 'vacía' }}
            · <span class="badge" [class.ok]="a.isActive">{{ a.isActive ? 'activo' : 'inactivo' }}</span>
          } @else { Sin configurar. }
        </p>
        <form [formGroup]="keys" (ngSubmit)="saveKeys()">
          <div class="field"><label for="kId">Llave de identidad (vacío = conservar la guardada)</label>
            <input id="kId" type="password" autocomplete="off" formControlName="identityKey" /></div>
          <div class="field"><label for="kSecret">Llave secreta (vacío = conservar; en pruebas Bold firma con llave vacía)</label>
            <input id="kSecret" type="password" autocomplete="off" formControlName="secretKey" /></div>
          <div class="field"><label for="kEmail">Correo del vendedor en Bold</label><input id="kEmail" type="email" formControlName="sellerEmail" /></div>
          <label class="row small"><input type="checkbox" formControlName="activate" style="width:auto;min-height:auto" /> Usar este ambiente para cobrar</label>
          <p class="err small" role="alert">{{ keysAction.error() }}</p>
          <button type="submit" class="primary" [disabled]="keys.invalid || keysAction.busy()">Guardar</button>
        </form>
        <h3 style="font-size:15px;margin-top:16px">Webhook</h3>
        <p class="small muted">Regístralo en panel.bold.co → Integraciones → Webhooks (el de pruebas como "Sandbox"). Debe ser HTTPS y público:</p>
        <code class="url">{{ webhookUrl }}</code>
      </section>

      <section class="card pad">
        <h2>Datáfono de cada caja</h2>
        <div class="row" style="margin-bottom:10px">
          <button type="button" class="sm" (click)="loadBold()" [disabled]="boldAction.busy()">Consultar datáfonos en Bold</button>
        </div>
        @if (boldMethods().length) {
          <p class="small">Métodos en Bold: @for (m of boldMethods(); track m.name) { <span class="badge" [class.ok]="m.enabled">{{ m.name }}</span> }</p>
        }
        <p class="err small" role="alert">{{ boldAction.error() }}</p>
        <table class="terminals">
          <thead><tr><th>Caja</th><th>Datáfono</th></tr></thead>
          <tbody>
            @for (r of registers.value() ?? []; track r.id) {
              <tr>
                <td>{{ r.name }} <span class="small muted">· {{ r.code }}</span></td>
                <td>
                  @if (terminals().length) {
                    <select [ngModel]="assigned()[r.id] ?? ''" (ngModelChange)="assign(r.id, $event)" [attr.aria-label]="'Datáfono de ' + r.name">
                      <option value="">— sin datáfono —</option>
                      @for (t of terminals(); track t.serial) { <option [value]="t.serial">{{ t.name || t.model }} · {{ t.serial }}</option> }
                    </select>
                  } @else { <span class="small">{{ assigned()[r.id] || '—' }}</span> }
                </td>
              </tr>
            } @empty { <tr><td colspan="2" class="state">Sin cajas.</td></tr> }
          </tbody>
        </table>
      </section>

      <section class="card pad">
        <h2>Cobro de prueba</h2>
        <p class="small muted">Llega al datáfono de la caja elegida, que debe tener la sesión abierta en el POS. En sandbox: de 1.000 a 2.000.000 se aprueba;
          111.111, 222.222, 333.333, 444.444 y 999.999 se rechazan.</p>
        <form [formGroup]="test" (ngSubmit)="startTest()">
          <div class="two">
            <div class="field"><label for="tReg">Caja</label>
              <select id="tReg" formControlName="cashRegisterId"><option value="">— elegir —</option>
                @for (r of registers.value() ?? []; track r.id) { <option [value]="r.id">{{ r.name }}</option> }</select></div>
            <div class="field"><label for="tMethod">Método</label>
              <select id="tMethod" formControlName="paymentMethodId"><option value="">— elegir —</option>
                @for (m of gatewayMethods(); track m.id) { <option [value]="m.id">{{ m.name }}</option> }</select></div>
          </div>
          <div class="field"><label for="tAmount">Monto</label><input id="tAmount" type="number" min="1" formControlName="amount" /></div>
          <p class="err small" role="alert">{{ testAction.error() }}</p>
          <button type="submit" class="primary" [disabled]="test.invalid || testAction.busy() || polling()">Enviar al datáfono</button>
        </form>
        @if (testPayment(); as p) {
          <div class="card pad" style="margin-top:12px">
            <div class="sum-row"><span>Monto</span><b>{{ p.amount | cop }}</b></div>
            <div class="sum-row"><span>Pago</span><b [class.ok]="p.status === 'approved'" [class.err]="p.status === 'declined' || p.status === 'cancelled'">{{ p.status }}</b></div>
            <div class="sum-row"><span>Bold</span><span>{{ p.attemptStatus ?? '—' }}</span></div>
            @if (p.attemptError) { <p class="small err">{{ p.attemptError }}</p> }
            @if (polling()) { <p class="small muted">Esperando el resultado del datáfono…</p> }
            @else if (p.status === 'pending') { <p class="small warn">Sigue pendiente. Si el datáfono ya mostró el resultado y el webhook no llega, resuélvelo en Ventas y caja → Pagos.</p> }
          </div>
        }
      </section>
    </div>
  `,
})
export class IntegrationsPage {
  private readonly bo = inject(BackofficeApi);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly webhookUrl = `${location.origin}/api/v1/webhooks/payments/bold`;
  protected readonly keysAction = new AsyncAction(this.toast);
  protected readonly boldAction = new AsyncAction(this.toast);
  protected readonly testAction = new AsyncAction(this.toast);
  protected readonly env = signal<Env>('sandbox');
  protected readonly accounts = resource({ loader: () => this.bo.gatewayAccounts() });
  protected readonly current = computed<GatewayAccountDto | undefined>(() => (this.accounts.value() ?? []).find((a) => a.environment === this.env()));
  protected readonly registers = resource({ loader: () => this.bo.cashRegisters() });
  protected readonly methods = resource({ loader: () => this.bo.paymentMethods() });
  protected readonly gatewayMethods = computed(() => (this.methods.value() ?? []).filter((m) => m.kind === 'gateway' && m.isActive));
  protected readonly terminals = signal<BoldTerminal[]>([]);
  protected readonly boldMethods = signal<BoldMethodStatus[]>([]);
  protected readonly assigned = signal<Record<string, string>>({});
  protected readonly testPayment = signal<PaymentDto | null>(null);
  protected readonly polling = signal(false);

  protected readonly keys = this.fb.group({
    identityKey: [''],
    secretKey: [''],
    sellerEmail: ['', [Validators.required, Validators.email]],
    activate: [true],
  });
  protected readonly test = this.fb.group({
    cashRegisterId: ['', Validators.required],
    paymentMethodId: ['', Validators.required],
    amount: [1000, [Validators.required, Validators.min(1)]],
  });
  private testKey = newIdempotencyKey();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    void this.loadAssigned();
    // The environment's stored email is shown on load (the keys never are).
    effect(() => {
      const a = this.current();
      if (a?.sellerEmail && !this.keys.controls.sellerEmail.value) this.keys.patchValue({ sellerEmail: a.sellerEmail });
    });
    this.test.valueChanges.subscribe(() => (this.testKey = newIdempotencyKey()));
    this.destroyRef.onDestroy(() => this.timer && clearTimeout(this.timer));
  }

  protected selectEnv(env: Env): void {
    this.env.set(env);
    this.keys.reset({ identityKey: '', secretKey: '', sellerEmail: this.current()?.sellerEmail ?? '', activate: true });
  }

  protected async saveKeys(): Promise<void> {
    const v = this.keys.getRawValue();
    const saved = await this.keysAction.run(() => this.bo.saveGatewayAccount({
      environment: this.env(), identityKey: v.identityKey.trim() || null, secretKey: v.secretKey.trim() || null,
      sellerEmail: v.sellerEmail.trim(), activate: v.activate,
    }), 'Integración guardada');
    // The typed keys are not kept in the form.
    this.keys.patchValue({ identityKey: '', secretKey: '' });
    if (saved) this.accounts.reload();
  }

  protected async loadBold(): Promise<void> {
    const r = await this.boldAction.run(async () => [await this.bo.boldTerminals(), await this.bo.boldMethods()] as const);
    if (r) { this.terminals.set(r[0]); this.boldMethods.set(r[1]); }
  }

  protected async assign(cashRegisterId: string, serial: string): Promise<void> {
    const t = this.terminals().find((x) => x.serial === serial);
    if (!t) return;
    const ok = await this.boldAction.run(() => this.bo.setRegisterTerminal(cashRegisterId, t.model, t.serial), 'Datáfono asignado');
    if (ok) this.assigned.update((a) => ({ ...a, [cashRegisterId]: t.serial }));
  }

  protected async startTest(): Promise<void> {
    const v = this.test.getRawValue();
    const p = await this.testAction.run(() => this.bo.testCharge({ ...v, amount: Number(v.amount) }, this.testKey));
    if (!p) return;
    this.testKey = newIdempotencyKey();
    this.testPayment.set(p);
    if (p.status === 'pending') this.poll(p.id, 0);
  }

  /** The result comes from the webhook; here only the stored status is queried. */
  private poll(id: string, n: number): void {
    this.polling.set(true);
    this.timer = setTimeout(async () => {
      const p = await this.bo.payment(id).catch(() => null);
      if (p) this.testPayment.set(p);
      if (p?.status === 'pending' && n + 1 < POLL_MAX) this.poll(id, n + 1);
      else this.polling.set(false);
    }, POLL_MS);
  }

  private async loadAssigned(): Promise<void> {
    const list = await this.bo.registerTerminals().catch(() => []);
    this.assigned.set(Object.fromEntries(list.map((t) => [t.cashRegisterId, t.terminalSerial])));
  }
}
