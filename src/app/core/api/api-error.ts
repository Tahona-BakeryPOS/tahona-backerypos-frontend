import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorBody } from './api.models';

/** Normalized error: everything that leaves the HTTP layer is converted to this. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }
}

const FALLBACK: Record<number, [string, string]> = {
  0: ['SIN_CONEXION', 'No hay conexión con el servidor.'],
  401: ['NO_AUTENTICADO', 'La sesión venció. Vuelve a ingresar.'],
  403: ['SIN_PERMISO', 'Tu rol no tiene permiso para esta operación.'],
  404: ['NO_ENCONTRADO', 'El recurso no existe.'],
  412: ['CONFLICTO_VERSION', 'Otra persona cambió este registro. Recarga e intenta de nuevo.'],
  429: ['DEMASIADAS_SOLICITUDES', 'Demasiados intentos seguidos. Espera un minuto.'],
};

export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (e instanceof HttpErrorResponse) {
    const body = (typeof e.error === 'object' ? e.error : null) as ApiErrorBody | null;
    const [code, msg] = FALLBACK[e.status] ?? ['ERROR', 'Ocurrió un error inesperado.'];
    return new ApiError(body?.codigo ?? code, body?.mensaje ?? msg, e.status);
  }
  return new ApiError('ERROR', e instanceof Error ? e.message : String(e), -1);
}
