import { HttpBackend, HttpClient, HttpContextToken, HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, from, switchMap, throwError } from 'rxjs';
import { AuthSessionDto } from '../api/api.models';
import { SessionStore } from './session.store';

/** Alternate token for a single request (e.g. the owner's who authorizes a withdrawal). */
export const OVERRIDE_TOKEN = new HttpContextToken<string | null>(() => null);

/** Only one refresh at a time: several requests that expire together wait for the same one. */
let refreshing: Promise<AuthSessionDto> | null = null;

/**
 * Sets the session's Bearer. In the backoffice, a 401 rotates the refresh token once and repeats the
 * request; if the refresh fails (expired, revoked or reused) the session is closed. The register has no
 * refresh: a 401 sends it back to the PIN.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionStore);
  const router = inject(Router);
  const backend = inject(HttpBackend);
  const borrowed = !!req.context.get(OVERRIDE_TOKEN);
  const withToken = (r: HttpRequest<unknown>, token: string | null) =>
    token ? r.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : r;

  return next(withToken(req, req.context.get(OVERRIDE_TOKEN) ?? session.token())).pipe(
    catchError((e: unknown) => {
      // A 401 with the session's token (not a borrowed one) means the session expired.
      if (!(e instanceof HttpErrorResponse) || e.status !== 401 || borrowed || !session.isAuthenticated() || isAuthCall(req.url)) {
        return throwError(() => e);
      }
      const user = session.user()!;
      if (user.kind === 'backoffice' && user.refreshToken) {
        return from(refresh(new HttpClient(backend), user.refreshToken)).pipe(
          catchError(() => {
            endSession(session, router, 'backoffice');
            return throwError(() => e);
          }),
          switchMap((s) => {
            session.start(s, 'backoffice');
            return next(withToken(req, s.accessToken));
          }),
        );
      }
      endSession(session, router, user.kind);
      return throwError(() => e);
    }),
  );
};

function refresh(http: HttpClient, refreshToken: string): Promise<AuthSessionDto> {
  refreshing ??= firstValueFrom(http.post<AuthSessionDto>('/api/v1/auth/refresh', { refreshToken })).finally(() => (refreshing = null));
  return refreshing;
}

/** Login, refresh and PIN answer 401 for credentials: they are not retried. */
const isAuthCall = (url: string) => /\/auth\/(login|login-pin|refresh)$/.test(url);

function endSession(session: SessionStore, router: Router, kind: 'backoffice' | 'pos'): void {
  session.end();
  void router.navigate([kind === 'backoffice' ? '/backoffice/sign-in' : '/login']);
}
