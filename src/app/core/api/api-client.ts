import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, firstValueFrom, throwError } from 'rxjs';
import { v7 as uuidv7 } from 'uuid';
import { OVERRIDE_TOKEN } from '../auth/auth.interceptor';
import { toApiError } from './api-error';

export const API = '/api/v1';

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

/** Opciones de una sola petición. */
export interface RequestOptions {
  /** Envía la petición con otro token Bearer (propietario que autoriza) sin tocar la sesión. */
  asToken?: string;
  /** POST marcado [Idempotent] en la API: exige `Idempotency-Key`. */
  idempotencyKey?: string;
  /** Versión leída (ETag) para `If-Match`; la API la exige en los PUT de datos maestros. */
  ifMatch?: string;
  headers?: Record<string, string>;
}

/** Clave nueva por intento lógico; reintentar el mismo intento debe reusarla. */
export const newIdempotencyKey = (): string => uuidv7();

/**
 * Cliente HTTP común de los gateways (PosApi, BackofficeApi): convierte cada respuesta en
 * promesa y cada error en ApiError.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  get<T>(path: string, params?: QueryParams, opts?: RequestOptions): Promise<T> {
    return this.send(this.http.get<T>(API + path, { params: toParams(params), ...request(opts) }));
  }

  post<T>(path: string, body: unknown = {}, opts?: RequestOptions): Promise<T> {
    return this.send(this.http.post<T>(API + path, body, request(opts)));
  }

  put<T>(path: string, body: unknown, opts?: RequestOptions): Promise<T> {
    return this.send(this.http.put<T>(API + path, body, request(opts)));
  }

  /** Archivo binario (p. ej. PDF), con el token de la sesión. */
  getBlob(path: string, opts?: RequestOptions): Promise<Blob> {
    return this.send(this.http.get(API + path, { responseType: 'blob', ...request(opts) }));
  }

  delete<T = void>(path: string, opts?: RequestOptions): Promise<T> {
    return this.send(this.http.delete<T>(API + path, request(opts)));
  }

  private send<T>(req: Observable<T>): Promise<T> {
    return firstValueFrom(req.pipe(catchError((e) => throwError(() => toApiError(e)))));
  }
}

function request(opts?: RequestOptions): { headers?: HttpHeaders; context?: HttpContext } {
  if (!opts) return {};
  const h: Record<string, string> = { ...opts.headers };
  if (opts.idempotencyKey) h['Idempotency-Key'] = opts.idempotencyKey;
  if (opts.ifMatch) h['If-Match'] = `"${opts.ifMatch}"`;
  return {
    ...(Object.keys(h).length ? { headers: new HttpHeaders(h) } : {}),
    ...(opts.asToken ? { context: new HttpContext().set(OVERRIDE_TOKEN, opts.asToken) } : {}),
  };
}

function toParams(params?: QueryParams): HttpParams | undefined {
  if (!params) return undefined;
  let p = new HttpParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') p = p.set(k, v);
  return p;
}
