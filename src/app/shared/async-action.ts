import { signal } from '@angular/core';
import { toApiError } from '../core/api/api-error';
import { ToastService } from './toast.service';

/**
 * Estado de una acción del usuario (guardar, crear, anular): ocupado, error legible y aviso al
 * terminar. Evita repetir try/catch/finally en cada formulario.
 */
export class AsyncAction {
  readonly busy = signal(false);
  readonly error = signal('');

  constructor(private readonly toast?: ToastService) {}

  async run<T>(fn: () => Promise<T>, done?: string): Promise<T | undefined> {
    this.busy.set(true);
    this.error.set('');
    try {
      const r = await fn();
      if (done) this.toast?.show(done);
      return r;
    } catch (e) {
      this.error.set(toApiError(e).message);
      return undefined;
    } finally {
      this.busy.set(false);
    }
  }
}
