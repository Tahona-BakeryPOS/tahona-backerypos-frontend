import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard, backofficeGuard, devicePairedGuard, landingFor, noShiftGuard, permissionGuard, shiftOpenGuard } from './core/auth/guards';
import { SessionStore } from './core/auth/session.store';
import { Perm, Permission } from './core/auth/permissions';

const bo = (path: string, title: string, perm: Permission | Permission[], load: Routes[number]['loadComponent'], data?: Record<string, unknown>): Routes[number] => ({
  path, title: `${title} · BakeryPOS`, canActivate: [permissionGuard(...[perm].flat())], loadComponent: load, data,
});

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'pos' },

  // ---- Caja: vincular dispositivo → PIN → abrir turno → vender ----
  { path: 'vincular', title: 'Vincular dispositivo · BakeryPOS', loadComponent: () => import('./features/pairing/pair-device.page').then((m) => m.PairDevicePage) },
  {
    path: '',
    canActivate: [devicePairedGuard],
    children: [
      { path: 'login', title: 'Ingresar · BakeryPOS', loadComponent: () => import('./features/login/login.page').then((m) => m.LoginPage) },
      {
        path: 'turno',
        title: 'Abrir caja · BakeryPOS',
        canActivate: [authGuard, noShiftGuard],
        loadComponent: () => import('./features/shift/open-shift.page').then((m) => m.OpenShiftPage),
      },
      {
        path: 'pos',
        canActivate: [authGuard, shiftOpenGuard],
        loadComponent: () => import('./features/pos/pos-shell.component').then((m) => m.PosShellComponent),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'venta' },
          { path: 'venta', title: 'Venta · BakeryPOS', loadComponent: () => import('./features/pos/sell/sell.page').then((m) => m.SellPage) },
          { path: 'ventas', title: 'Ventas del turno · BakeryPOS', loadComponent: () => import('./features/pos/shift-sales/shift-sales.page').then((m) => m.ShiftSalesPage) },
          { path: 'caja', title: 'Caja · BakeryPOS', loadComponent: () => import('./features/pos/cash/cash.page').then((m) => m.CashPage) },
        ],
      },
    ],
  },

  // ---- Backoffice: correo y contraseña, desde cualquier equipo ----
  { path: 'backoffice/ingresar', title: 'Backoffice · BakeryPOS', loadComponent: () => import('./features/backoffice/backoffice-login.page').then((m) => m.BackofficeLoginPage) },
  {
    path: 'backoffice',
    canActivate: [backofficeGuard],
    loadComponent: () => import('./features/backoffice/backoffice-shell.component').then((m) => m.BackofficeShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: () => landingFor(inject(SessionStore)) },
      // Fase 2 (API v2)
      bo('plataforma/empresas', 'Empresas de la plataforma', Perm.plataformaAdmin, () => import('./features/backoffice/plataforma/platform-companies.page').then((m) => m.PlatformCompaniesPage)),
      { path: 'sin-acceso', title: 'Sin pantallas · BakeryPOS', loadComponent: () => import('./features/backoffice/no-access.page').then((m) => m.NoAccessPage) },
      bo('negocio/empresa', 'Empresa', Perm.organizacionGestionar, () => import('./features/backoffice/negocio/company.page').then((m) => m.CompanyPage)),
      bo('negocio/sucursales', 'Sucursales y cajas', Perm.organizacionGestionar, () => import('./features/backoffice/negocio/branches.page').then((m) => m.BranchesPage)),
      bo('negocio/puntos-venta', 'Puntos de venta', Perm.organizacionGestionar, () => import('./features/backoffice/negocio/points-of-sale.page').then((m) => m.PointsOfSalePage)),
      bo('configuracion/usuarios', 'Usuarios', Perm.organizacionGestionar, () => import('./features/backoffice/configuracion/users.page').then((m) => m.UsersPage)),
      bo('configuracion/roles', 'Roles', Perm.organizacionGestionar, () => import('./features/backoffice/configuracion/roles.page').then((m) => m.RolesPage)),
      // Fase 3 (API v2)
      bo('productos/catalogo', 'Catálogo y precios', [Perm.catalogoGestionar, Perm.preciosSucursal], () => import('./features/backoffice/productos/products.page').then((m) => m.ProductsPage)),
      bo('productos/categorias', 'Categorías', Perm.catalogoGestionar, () => import('./features/backoffice/productos/categories.page').then((m) => m.CategoriesPage)),
      bo('productos/unidades', 'Unidades', Perm.catalogoGestionar, () => import('./features/backoffice/productos/units.page').then((m) => m.UnitsPage)),
      bo('informes/auditoria', 'Auditoría', Perm.organizacionGestionar, () => import('./features/backoffice/informes/audit.page').then((m) => m.AuditPage)),
      bo('configuracion/impuestos', 'Impuestos', Perm.catalogoGestionar, () => import('./features/backoffice/configuracion/taxes.page').then((m) => m.TaxesPage)),
      bo('configuracion/historial', 'Historial de cambios', Perm.organizacionGestionar, () => import('./features/backoffice/informes/audit.page').then((m) => m.AuditPage)),
      // Fase 4 (API v2)
      bo('inventario/existencias', 'Existencias', Perm.inventarioVer, () => import('./features/backoffice/inventario/stock.page').then((m) => m.StockPage)),
      bo('inventario/movimientos', 'Movimientos de inventario', Perm.inventarioVer, () => import('./features/backoffice/inventario/movements.page').then((m) => m.MovementsPage)),
      bo('inventario/ajustes', 'Ajustes de inventario', Perm.inventarioAjustar, () => import('./features/backoffice/inventario/adjustments.page').then((m) => m.AdjustmentsPage)),
      // Fase 5 (API v2)
      bo('ventas/turnos', 'Turnos', Perm.reportesVer, () => import('./features/backoffice/ventas/shifts.page').then((m) => m.ShiftsPage), { mode: 'turnos' }),
      bo('ventas/cierres', 'Cierres', Perm.reportesVer, () => import('./features/backoffice/ventas/shifts.page').then((m) => m.ShiftsPage), { mode: 'cierres' }),
      // Fase 6 (API v2)
      bo('ventas/pagos', 'Pagos', Perm.reportesVer, () => import('./features/backoffice/ventas/payments.page').then((m) => m.PaymentsPage)),
      bo('ventas/medios-pago', 'Métodos de pago', Perm.organizacionGestionar, () => import('./features/backoffice/ventas/payment-methods.page').then((m) => m.PaymentMethodsPage)),
      bo('configuracion/integraciones', 'Integraciones', Perm.organizacionGestionar, () => import('./features/backoffice/configuracion/integrations.page').then((m) => m.IntegrationsPage)),
      // Fase 7 (API v2)
      bo('ventas/documentos-fiscales', 'Facturas electrónicas', Perm.ventasVer, () => import('./features/backoffice/ventas/fiscal-documents.page').then((m) => m.FiscalDocumentsPage)),
      bo('configuracion/facturacion', 'Facturación electrónica', Perm.fiscalGestionar, () => import('./features/backoffice/configuracion/invoicing.page').then((m) => m.InvoicingPage)),
      bo('configuracion/numeraciones', 'Numeraciones', Perm.fiscalGestionar, () => import('./features/backoffice/configuracion/sequences.page').then((m) => m.SequencesPage)),
      // Fase 8 (API v2)
      bo('ventas/ventas', 'Ventas', Perm.ventasVer, () => import('./features/backoffice/ventas/sales.page').then((m) => m.SalesPage)),
      // Fase 9 (API v2)
      bo('panel', 'Panel de control', Perm.reportesVer, () => import('./features/backoffice/panel/dashboard.page').then((m) => m.DashboardPage)),
      bo('ventas/devoluciones', 'Devoluciones', Perm.reportesVer, () => import('./features/backoffice/ventas/returns.page').then((m) => m.ReturnsPage)),
      bo('informes/ventas', 'Informe de ventas', Perm.reportesVer, () => import('./features/backoffice/informes/sales-report.page').then((m) => m.SalesReportPage)),
    ],
  },

  { path: '**', redirectTo: 'pos' },
];
