# Tahona.BakeryPOS v2 — Frontend

PWA (Angular 22, standalone, signals, OnPush) del POS SaaS para panaderías en Colombia: **POS de caja** (tablet/PC) y **backoffice**.
Este repo es **solo el frontend**; la API y el diseño del sistema viven en el repo del backend
(`tahona-backerypos-backend`). Cada repo tiene su CI/CD y su documentación.

Repo: <https://github.com/Tahona-BakeryPOS/tahona-backerypos-frontend>
Backend: <https://github.com/Tahona-BakeryPOS/tahona-backerypos-backend> (diseño en su carpeta `docs/`).

## Fuente de verdad del API

El contrato HTTP, los permisos y las reglas de negocio están en el backend, no aquí:
`docs/api-contracts.md`, `docs/requirements.md`, `docs/decisions.md` y `docs/estado-casos-de-uso.md` de ese repo.
Los DTO de `src/app/core/api/api.models.ts` espejan los de `Tahona.BakeryPOS.Application`, y los códigos de permiso de
`src/app/core/auth/permissions.ts` salen de `Common/Security/Permissions.cs`. Si el backend cambia un contrato, se ajusta aquí.
Este frontend no inventa endpoints ni respuestas: lo que el backend no expone se marca "Próximamente".

## Estado

Pantallas sobre la API v2: ingreso al backoffice (contraseña de un solo uso, elección de empresa, refresh token),
plataforma/empresas, sucursales y cajas, puntos de venta, usuarios y roles, vinculación del equipo y entrada con PIN;
catálogo y precios, categorías, unidades, impuestos, auditoría; existencias, movimientos y ajustes; apertura de caja,
Caja (ingresos/retiros) y cierre, Turnos y Cierres; Pagos, Métodos de pago e Integraciones (Bold); Facturación
electrónica (opcional por empresa, D-17), Numeraciones y Facturas electrónicas; la venta del POS (cobro en vivo, autorización de existencias,
comprobante con estado de la factura), Ventas del turno y Ventas; anular y devolver, Devoluciones, Informe de ventas y
Panel de control. **Se retiró el modo sin conexión de la v1** (el service worker solo cachea la app).

## Estructura

```
src/app/
  core/       api (cliente HTTP, modelos, idempotencia), auth, catalog, device, domain, sales, shift, storage
  features/   backoffice, login, pairing, pos, shift
  shared/     pipes, toasts y utilidades de UI
e2e/          Playwright contra staging (ver e2e/README.md)
docs/         documentación propia del frontend
```

## Convenciones

- Standalone components, signals y `ChangeDetectionStrategy.OnPush`.
- Acceso HTTP por gateways por módulo (`core/api`); las pantallas no llaman a `HttpClient` directamente.
- Todo POST reintentable envía `Idempotency-Key` (`newIdempotencyKey`); los `PUT` de datos maestros envían `If-Match`.
- El estado del pago, de la venta, del inventario y de la factura se muestran por separado; un pago solo se da por
  aprobado cuando el backend lo informa.
- Secretos y llaves de terceros nunca viven en el frontend.
- Pedir aprobación antes de: añadir dependencias importantes o cambiar el alcance.

## Comandos

```bash
npm ci
npm start                      # ng serve; /api va por proxy a https://localhost:7246 (proxy.conf.json)
npm test                       # ng test
npx ng build --configuration production
npm run e2e                    # Playwright contra staging
npm run e2e:typecheck
```

## CI/CD y despliegue

- CI: `.github/workflows/ci.yml` (tests, build de producción, typecheck de E2E, build de la imagen Docker).
- La imagen (`Dockerfile`) compila la app y la sirve con Caddy; en staging/producción el `Caddyfile` y el compose viven en
  el repo del backend (`deploy/`), que espera este repo clonado junto a él (`FRONTEND_DIR`, por defecto `../../frontend`).
