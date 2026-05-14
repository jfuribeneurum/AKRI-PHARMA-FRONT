import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { ShellComponent } from './layout/shell.component';
import { LoginComponent } from './pages/login.component';
import { DashboardComponent } from './pages/dashboard.component';
import { ProductsComponent } from './pages/products.component';
import { ProvidersComponent } from './pages/providers.component';
import { InventoryComponent } from './pages/inventory.component';
import { PurchasesComponent } from './pages/purchases.component';
import { SebasPurchaseOrderComponent } from './pages/sebas-purchase-order.component';
import { SalesComponent } from './pages/sales.component';
import { IngresosComponent } from './pages/ingresos.component';
import { SebasIngresosComponent } from './pages/sebas-ingresos.component';
import { DispensingComponent } from './pages/dispensing.component';
import { ColdChainComponent } from './pages/cold-chain.component';
import { BillingComponent } from './pages/billing.component';
import { ReportsComponent } from './pages/reports.component';
import { SettingsComponent } from './pages/settings.component';
import { AdminComponent } from './pages/admin.component';
import { BodegasComponent } from './pages/bodegas.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'products', component: ProductsComponent },
      { path: 'providers', component: ProvidersComponent },
      { path: 'inventory', component: InventoryComponent },
      { path: 'bodegas', component: BodegasComponent },
      { path: 'purchases', component: PurchasesComponent },
      { path: 'sebas-purchase-order', component: SebasPurchaseOrderComponent },
      { path: 'sales', component: SalesComponent },
      { path: 'ingresos', component: IngresosComponent },
      { path: 'sebas-ingresos', component: SebasIngresosComponent },
      { path: 'dispensing', component: DispensingComponent },
      { path: 'dispensing-sebas', component: DispensingComponent },
      { path: 'cold-chain', component: ColdChainComponent },
      { path: 'billing', component: BillingComponent },
      { path: 'reports', component: ReportsComponent },
      { path: 'settings', component: SettingsComponent },
      { path: 'admin', component: AdminComponent }
    ]
  },
  { path: '**', redirectTo: '' }
];
