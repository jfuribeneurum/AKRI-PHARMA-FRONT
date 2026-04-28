import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { ShellComponent } from './layout/shell.component';
import { LoginComponent } from './pages/login.component';
import { DashboardComponent } from './pages/dashboard.component';
import { ProductsComponent } from './pages/products.component';
import { InventoryComponent } from './pages/inventory.component';
import { PurchasesComponent } from './pages/purchases.component';
import { SalesComponent } from './pages/sales.component';
import { DispensingComponent } from './pages/dispensing.component';
import { ColdChainComponent } from './pages/cold-chain.component';
import { BillingComponent } from './pages/billing.component';
import { ReportsComponent } from './pages/reports.component';
import { SettingsComponent } from './pages/settings.component';
import { AdminComponent } from './pages/admin.component';

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
      { path: 'inventory', component: InventoryComponent },
      { path: 'purchases', component: PurchasesComponent },
      { path: 'sales', component: SalesComponent },
      { path: 'dispensing', component: DispensingComponent },
      { path: 'cold-chain', component: ColdChainComponent },
      { path: 'billing', component: BillingComponent },
      { path: 'reports', component: ReportsComponent },
      { path: 'settings', component: SettingsComponent },
      { path: 'admin', component: AdminComponent }
    ]
  },
  { path: '**', redirectTo: '' }
];
