import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, firstValueFrom, throwError } from 'rxjs';
import { v7 as uuidv7 } from 'uuid';
import { OVERRIDE_TOKEN } from '../auth/auth.interceptor';
import { toApiError } from './api-error';

export const API = '/api/v1';

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

/** Single-request options. */
export interface RequestOptions {
  /** Sends the request with another Bearer token (the authorizing owner) without touching the session. */
  asToken?: string;
  /** POST marked [Idempotent] in the API: it requires `Idempotency-Key`. */
  idempotencyKey?: string;
  /** Version read (ETag) for `If-Match`; the API requires it on master-data PUTs. */
  ifMatch?: string;
  headers?: Record<string, string>;
}

/** A new key per logical attempt; retrying the same attempt must reuse it. */
export const newIdempotencyKey = (): string => uuidv7();

/**
 * Common HTTP client of the gateways (PosApi, BackofficeApi): turns each response into a
 * promise and each error into an ApiError.
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

  /** Binary file (e.g. PDF), with the session's token. */
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
