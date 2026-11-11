# Tahona.BakeryPOS — Frontend

Aplicación web progresiva (PWA) del punto de venta (POS) SaaS para panaderías en Colombia. Incluye el **POS de caja**,
pensado para tablet o PC, y el **backoffice** de administración.

La API está en su propio repositorio:
[tahona-backerypos-backend](https://github.com/Tahona-BakeryPOS/tahona-backerypos-backend), que además guarda el
diseño del sistema y el contrato del API.

## Qué incluye

**POS de caja**
- Vinculación del equipo a una caja y entrada con PIN.
- Apertura de caja, ingresos y retiros de efectivo, y cierre del turno.
- Venta con cobro en el datáfono (Bold), autorización de existencias y comprobante con el estado de la factura.
- Ventas del turno, anulaciones y devoluciones.

**Backoffice**
- Plataforma, empresa, sucursales, cajas, usuarios y roles.
- Catálogo, precios, categorías, unidades e impuestos.
- Existencias, movimientos y ajustes de inventario.
- Turnos y cierres, pagos y métodos de pago.
- Integraciones (Bold), facturación electrónica, numeraciones y facturas.
- Ventas, devoluciones, informe de ventas, panel de control y auditoría.

Las pantallas se muestran según los permisos del usuario.

## Tecnología

Angular 22 (componentes standalone, signals, `OnPush`) · TypeScript · Vitest · Playwright · service worker (PWA).

## Estructura

```
src/app/
  core/       cliente HTTP, modelos del API, autenticación, catálogo, dispositivo, venta y turno
  features/   backoffice, login, pairing, pos, shift
  shared/     pipes, notificaciones y utilidades de interfaz
e2e/          pruebas de extremo a extremo (Playwright)
docs/         documentación propia del frontend
```

## Requisitos

- Node.js 24 y npm
- La API en ejecución (por defecto en `https://localhost:7246`; ver `proxy.conf.json`)

## Puesta en marcha

```bash
npm ci
npm start
```

Abre `http://localhost:4200/`. Las llamadas a `/api` se reenvían a la API mediante `proxy.conf.json`.

## Scripts

| Comando | Descripción |
|---|---|
| `npm start` | Servidor de desarrollo |
| `npm test` | Pruebas unitarias |
| `npx ng build --configuration production` | Compilación de producción en `dist/pos` |
| `npm run e2e` | Pruebas E2E con Playwright (ver [`e2e/README.md`](e2e/README.md)) |
| `npm run e2e:typecheck` | Verifica que las pruebas E2E compilan |

## Docker y despliegue

El `Dockerfile` compila la aplicación y la sirve con Caddy, que además termina HTTPS y hace de proxy de `/api` hacia el API
(`API_UPSTREAM`). El despliegue es propio de este repo y no depende del backend:

```bash
cd deploy
cp .env.deploy.example .env.production   # completar DOMAIN, ACME_EMAIL y API_UPSTREAM
bash ./scripts/deploy.sh .env.production
```

## CI

`.github/workflows/ci.yml`: instala dependencias, ejecuta las pruebas, compila para producción, verifica los tipos de
las pruebas E2E, construye la imagen Docker y publica el resultado de la compilación como artefacto.

## Documentación

- [`CLAUDE.md`](CLAUDE.md) — contexto y convenciones del proyecto
- [`docs/README.md`](docs/README.md) — índice de documentación
- [`e2e/README.md`](e2e/README.md) — pruebas E2E
- [Guía general para personas no técnicas](https://github.com/Tahona-BakeryPOS/tahona-backerypos-backend/blob/main/docs/guia-general.md) (en el repositorio del backend)
- Contrato del API y decisiones: carpeta `docs/` del repositorio del backend
