# Frontend decisions

Decisions specific to the web client. The system decisions and the API contract are in the backend repository (`docs/decisions.md`).

| # | Decision | Reason |
|---|---|---|
| F-01 | Session and menu: the session (with the backoffice refresh token) lives in `sessionStorage` and does not survive closing the tab; a 401 from the backoffice rotates the refresh token once and repeats the request. Screens of the previous system that use endpoints the API does not have yet are removed from the menu ("Próximamente") until their phase. A supervisor's authorization at the register (withdrawals, voids) asks for their name in addition to the PIN, because `login-pin` requires `userId`. After pairing, the device has no payment methods or cash reasons: the API does not yet have a device-configuration endpoint (phases 3, 5 and 6) | Follow the API contract without inventing endpoints; do not leave the refresh token on shared devices |
