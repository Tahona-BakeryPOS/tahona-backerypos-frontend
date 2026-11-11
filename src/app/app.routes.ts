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

  // ---- Register: pair device → PIN → open shift → sell ----
  { path: 'pair-device', title: 'Vincular dispositivo · BakeryPOS', loadComponent: () => import('./features/pairing/pair-device.page').then((m) => m.PairDevicePage) },
  {
    path: '',
    canActivate: [devicePairedGuard],
    children: [
      { path: 'login', title: 'Ingresar · BakeryPOS', loadComponent: () => import('./features/login/login.page').then((m) => m.LoginPage) },
      {
        path: 'shift',
        title: 'Abrir caja · BakeryPOS',
        canActivate: [authGuard, noShiftGuard],
        loadComponent: () => import('./features/shift/open-shift.page').then((m) => m.OpenShiftPage),
      },
      {
        path: 'pos',
        canActivate: [authGuard, shiftOpenGuard],
        loadComponent: () => import('./features/pos/pos-shell.component').then((m) => m.PosShellComponent),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'sell' },
          { path: 'sell', title: 'Venta · BakeryPOS', loadComponent: () => import('./features/pos/sell/sell.page').then((m) => m.SellPage) },
          { path: 'shift-sales', title: 'Ventas del turno · BakeryPOS', loadComponent: () => import('./features/pos/shift-sales/shift-sales.page').then((m) => m.ShiftSalesPage) },
          { path: 'cash', title: 'Caja · BakeryPOS', loadComponent: () => import('./features/pos/cash/cash.page').then((m) => m.CashPage) },
        ],
      },
    ],
  },

  // ---- Backoffice: email and password, from any device ----
  { path: 'backoffice/sign-in', title: 'Backoffice · BakeryPOS', loadComponent: () => import('./features/backoffice/backoffice-login.page').then((m) => m.BackofficeLoginPage) },
  {
    path: 'backoffice',
    canActivate: [backofficeGuard],
    loadComponent: () => import('./features/backoffice/backoffice-shell.component').then((m) => m.BackofficeShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: () => landingFor(inject(SessionStore)) },
      // Phase 2
      bo('platform/companies', 'Empresas de la plataforma', Perm.platformAdmin, () => import('./features/backoffice/platform/platform-companies.page').then((m) => m.PlatformCompaniesPage)),
      { path: 'no-access', title: 'Sin pantallas · BakeryPOS', loadComponent: () => import('./features/backoffice/no-access.page').then((m) => m.NoAccessPage) },
      bo('business/company', 'Empresa', Perm.organizationManage, () => import('./features/backoffice/business/company.page').then((m) => m.CompanyPage)),
      bo('business/branches', 'Sucursales y cajas', Perm.organizationManage, () => import('./features/backoffice/business/branches.page').then((m) => m.BranchesPage)),
      bo('business/points-of-sale', 'Puntos de venta', Perm.organizationManage, () => import('./features/backoffice/business/points-of-sale.page').then((m) => m.PointsOfSalePage)),
      bo('settings/users', 'Usuarios', Perm.organizationManage, () => import('./features/backoffice/settings/users.page').then((m) => m.UsersPage)),
      bo('settings/roles', 'Roles', Perm.organizationManage, () => import('./features/backoffice/settings/roles.page').then((m) => m.RolesPage)),
      // Phase 3
      bo('products/catalog', 'Catálogo y precios', [Perm.catalogManage, Perm.branchPrices], () => import('./features/backoffice/products/products.page').then((m) => m.ProductsPage)),
      bo('products/categories', 'Categorías', Perm.catalogManage, () => import('./features/backoffice/products/categories.page').then((m) => m.CategoriesPage)),
      bo('products/units', 'Unidades', Perm.catalogManage, () => import('./features/backoffice/products/units.page').then((m) => m.UnitsPage)),
      bo('reports/audit', 'Auditoría', Perm.organizationManage, () => import('./features/backoffice/reports/audit.page').then((m) => m.AuditPage)),
      bo('settings/taxes', 'Impuestos', Perm.catalogManage, () => import('./features/backoffice/settings/taxes.page').then((m) => m.TaxesPage)),
      bo('settings/history', 'Historial de cambios', Perm.organizationManage, () => import('./features/backoffice/reports/audit.page').then((m) => m.AuditPage)),
      // Phase 4
      bo('inventory/stock', 'Existencias', Perm.inventoryView, () => import('./features/backoffice/inventory/stock.page').then((m) => m.StockPage)),
      bo('inventory/movements', 'Movimientos de inventario', Perm.inventoryView, () => import('./features/backoffice/inventory/movements.page').then((m) => m.MovementsPage)),
      bo('inventory/adjustments', 'Ajustes de inventario', Perm.inventoryAdjust, () => import('./features/backoffice/inventory/adjustments.page').then((m) => m.AdjustmentsPage)),
      // Phase 5
      bo('sales/shifts', 'Turnos', Perm.reportsView, () => import('./features/backoffice/sales/shifts.page').then((m) => m.ShiftsPage), { mode: 'shifts' }),
      bo('sales/closings', 'Cierres', Perm.reportsView, () => import('./features/backoffice/sales/shifts.page').then((m) => m.ShiftsPage), { mode: 'closings' }),
      // Phase 6
      bo('sales/payments', 'Pagos', Perm.reportsView, () => import('./features/backoffice/sales/payments.page').then((m) => m.PaymentsPage)),
      bo('sales/payment-methods', 'Métodos de pago', Perm.organizationManage, () => import('./features/backoffice/sales/payment-methods.page').then((m) => m.PaymentMethodsPage)),
      bo('settings/integrations', 'Integraciones', Perm.organizationManage, () => import('./features/backoffice/settings/integrations.page').then((m) => m.IntegrationsPage)),
      // Phase 7
      bo('sales/fiscal-documents', 'Facturas electrónicas', Perm.salesView, () => import('./features/backoffice/sales/fiscal-documents.page').then((m) => m.FiscalDocumentsPage)),
      bo('settings/invoicing', 'Facturación electrónica', Perm.fiscalManage, () => import('./features/backoffice/settings/invoicing.page').then((m) => m.InvoicingPage)),
      bo('settings/numberings', 'Numeraciones', Perm.fiscalManage, () => import('./features/backoffice/settings/sequences.page').then((m) => m.SequencesPage)),
      // Phase 8
      bo('sales/sales', 'Ventas', Perm.salesView, () => import('./features/backoffice/sales/sales.page').then((m) => m.SalesPage)),
      // Phase 9
      bo('dashboard', 'Panel de control', Perm.reportsView, () => import('./features/backoffice/dashboard/dashboard.page').then((m) => m.DashboardPage)),
      bo('sales/returns', 'Devoluciones', Perm.reportsView, () => import('./features/backoffice/sales/returns.page').then((m) => m.ReturnsPage)),
      bo('reports/sales', 'Informe de ventas', Perm.reportsView, () => import('./features/backoffice/reports/sales-report.page').then((m) => m.SalesReportPage)),
    ],
  },

  { path: '**', redirectTo: 'pos' },
];
