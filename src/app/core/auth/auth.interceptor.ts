import { HttpBackend, HttpClient, HttpContextToken, HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, from, switchMap, throwError } from 'rxjs';
import { AuthSessionDto } from '../api/api.models';
import { SessionStore } from './session.store';

/** Token alterno para una sola solicitud (p. ej. el del propietario que autoriza un retiro). */
export const OVERRIDE_TOKEN = new HttpContextToken<string | null>(() => null);

/** Un solo refresh a la vez: varias peticiones que vencen juntas esperan el mismo. */
let refreshing: Promise<AuthSessionDto> | null = null;

/**
 * Pone el Bearer de la sesión. En el backoffice, un 401 rota el refresh token una vez y repite la
 * petición; si el refresh falla (vencido, revocado o reusado) la sesión se cierra. La caja no tiene
 * refresh: un 401 la devuelve al PIN.
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
      // Un 401 con el token de la sesión (no con uno prestado) significa que la sesión venció.
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

/** Login, refresh y PIN responden 401 por credenciales: no se reintentan. */
const isAuthCall = (url: string) => /\/auth\/(login|login-pin|refresh)$/.test(url);

function endSession(session: SessionStore, router: Router, kind: 'backoffice' | 'pos'): void {
  session.end();
  void router.navigate([kind === 'backoffice' ? '/backoffice/ingresar' : '/login']);
}
