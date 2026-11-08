# Pruebas E2E (Playwright)

Recorren el flujo de caja en efectivo contra una API real con PostgreSQL: vincular la caja, entrar con PIN, abrir caja,
dos ventas, anulación y devolución autorizadas con el PIN de un supervisor, cierre sin diferencia e informe del backoffice.
No prueban Bold ni Siigo: esos se prueban en sus sandbox (runbook del backend, "Pruebas con proveedores").

## Requisitos

- Un ambiente corriendo: local (`ng serve` + API + Postgres de desarrollo) o **staging**. Nunca producción: el
  setup se niega si la URL no es `localhost` o no contiene `staging`.
- Una empresa de pruebas con su propietario (contraseña definitiva ya cambiada), sin facturación electrónica activa.
- Navegador: `npx playwright install chromium` (una vez).

## Variables

| Variable | Para qué |
|---|---|
| `E2E_BASE_URL` | URL del frontend (por defecto `http://localhost:4200`) |
| `E2E_API_URL` | URL de la API (por defecto `$E2E_BASE_URL/api/v1`) |
| `E2E_OWNER_EMAIL`, `E2E_OWNER_PASSWORD` | Propietario de la empresa de pruebas |
| `E2E_COMPANY_ID` | Opcional, si el usuario tiene varias empresas |
| `E2E_IGNORE_HTTPS_ERRORS` | `1` con el certificado de desarrollo local |

Cada corrida crea su sucursal, caja, cajero, supervisor y producto (nombres con sufijo de la corrida) y deja
`e2e/.state.json` con los PIN generados (no versionado).

## Correr

```bash
npm run e2e
```

El reporte HTML queda en `e2e/playwright-report/`.
