import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent) },
  { path: 'module-select', canActivate: [authGuard], loadComponent: () => import('./pages/module-select/module-select.component').then(m => m.ModuleSelectComponent) },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard',           loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'products',            loadComponent: () => import('./pages/products/products.component').then(m => m.ProductsComponent) },
      { path: 'providers',           loadComponent: () => import('./pages/providers/providers.component').then(m => m.ProvidersComponent) },
      { path: 'inventory',           loadComponent: () => import('./pages/inventory/inventory.component').then(m => m.InventoryComponent) },
      { path: 'bodegas',             loadComponent: () => import('./pages/bodegas/bodegas.component').then(m => m.BodegasComponent) },
      { path: 'purchases',           loadComponent: () => import('./pages/purchases/purchases.component').then(m => m.PurchasesComponent) },
      { path: 'sebas-purchase-order',loadComponent: () => import('./pages/sebas-purchase-order/sebas-purchase-order.component').then(m => m.SebasPurchaseOrderComponent) },
      { path: 'sales',               loadComponent: () => import('./pages/sales/sales.component').then(m => m.SalesComponent) },
      { path: 'ingresos',            loadComponent: () => import('./pages/ingresos/ingresos.component').then(m => m.IngresosComponent) },
      { path: 'sebas-ingresos',      loadComponent: () => import('./pages/sebas-ingresos/sebas-ingresos.component').then(m => m.SebasIngresosComponent) },
      { path: 'dispensing',          loadComponent: () => import('./pages/dispensing/dispensing.component').then(m => m.DispensingComponent) },
      { path: 'dispensing-sebas',    loadComponent: () => import('./pages/dispensacion-sebas/dispensacion-sebas.component').then(m => m.DispensacionSebasComponent) },
      { path: 'cold-chain',          loadComponent: () => import('./pages/cold-chain/cold-chain.component').then(m => m.ColdChainComponent) },
      { path: 'billing',             loadComponent: () => import('./pages/billing/billing.component').then(m => m.BillingComponent) },
      { path: 'reports',             loadComponent: () => import('./pages/reports/reports.component').then(m => m.ReportsComponent) },
      { path: 'settings',            loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent) },
      { path: 'admin',               loadComponent: () => import('./pages/admin/admin.component').then(m => m.AdminComponent) },
      { path: 'maestro-mx',          loadComponent: () => import('./pages/maestro-mx/maestro-mx.component').then(m => m.MaestroMxComponent) },
      { path: 'devolucion-pedido',   loadComponent: () => import('./pages/devolucion-pedido/devolucion-pedido.component').then(m => m.DevolucionPedidoComponent) },
      { path: 'entrada',             loadComponent: () => import('./pages/movimiento-entrada/movimiento-entrada.component').then(m => m.MovimientoEntradaComponent) },
      { path: 'salida',              loadComponent: () => import('./pages/movimiento-salida/movimiento-salida.component').then(m => m.MovimientoSalidaComponent) },
      { path: 'traslados',           loadComponent: () => import('./pages/traslados/traslados.component').then(m => m.TrasladosComponent) },
      { path: 'pacientes',           loadComponent: () => import('./pages/pacientes/pacientes.component').then(m => m.PacientesComponent) },
      { path: 'ciudades',            loadComponent: () => import('./pages/ciudades/ciudades.component').then(m => m.CiudadesComponent) },
      { path: 'trazabilidad',        loadComponent: () => import('./pages/trazabilidad/trazabilidad.component').then(m => m.TrazabilidadComponent) }
    ]
  },
  { path: '**', redirectTo: '' }
];
