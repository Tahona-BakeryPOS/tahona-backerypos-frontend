# Decisiones del frontend

Decisiones propias del cliente web. Las del sistema y el contrato del API están en el repositorio del backend (`docs/decisions.md`).

| # | Decisión | Motivo |
|---|---|---|
| F-01 | Sesión y menú: la sesión (con el refresh token del backoffice) vive en `sessionStorage`, no sobrevive a cerrar la pestaña; un 401 del backoffice rota el refresh token una vez y repite la petición. Las pantallas del sistema anterior que usan endpoints que el API aún no tiene salen del menú ("Próximamente") hasta su fase. La autorización de un superior en la caja (retiros, anulaciones) pide elegir su nombre además del PIN, porque `login-pin` exige `userId`. Tras vincular, el equipo no tiene medios de pago ni motivos de caja: el API no tiene aún un endpoint de configuración del equipo (fases 3, 5 y 6) | Seguir el contrato del API sin inventar endpoints; no dejar el refresh token en equipos compartidos |
