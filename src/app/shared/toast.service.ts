import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';

/** Brief non-blocking notices ("Venta registrada", "Turno abierto"). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly message = signal<string | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  show(msg: string, ms = 2800): void {
    clearTimeout(this.timer);
    this.message.set(msg);
    this.timer = setTimeout(() => this.message.set(null), ms);
  }
}

@Component({
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (toast.message(); as m) { <div class="toast" role="status">{{ m }}</div> }`,
})
export class ToastHostComponent {
  protected readonly toast = inject(ToastService);
}
