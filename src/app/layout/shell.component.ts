import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';

@Component({
  selector: 'akri-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="layout">
      <aside class="sidebar">
        <div class="brand">AkriPharmacy</div>
        <div class="brand-subtitle">ERP farmacéutico multisede · multiusuario · cadena de frío automática · dispensación con firma</div>

        <nav>
          <a routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
          <a routerLink="/products" routerLinkActive="active">Productos e imágenes</a>
          <a routerLink="/ingresos" routerLinkActive="active">Ingresos</a>
          <a routerLink="/inventory" routerLinkActive="active">Inventario y escaneo</a>
          <a routerLink="/purchases" routerLinkActive="active">Compras</a>
          <a routerLink="/sales" routerLinkActive="active">Ventas</a>
          <a routerLink="/dispensing" routerLinkActive="active">Dispensación</a>
          <a routerLink="/cold-chain" routerLinkActive="active">Cadena de frío</a>
          <a routerLink="/billing" routerLinkActive="active">Facturación</a>
          <a routerLink="/reports" routerLinkActive="active">Reportes y exportación</a>
          <a routerLink="/admin" routerLinkActive="active">Administración</a>
          <a routerLink="/settings" routerLinkActive="active">SIESA / Config</a>
        </nav>
      </aside>

      <main class="content">
        <header class="topbar">
          <div>
            <strong>ERP Gestión de Inventario Farmacéutico</strong>
            <div class="muted">Paleta violeta/naranja, operación por lotes, multisede, multiusuario, cadena de frío e integración SIESA.</div>
          </div>
          <div class="topbar-actions">
            <span class="chip primary">Multisede</span>
            <span class="chip info">Termohigrómetros</span>
            <span class="chip accent">Dispensación</span>
            <button class="btn secondary" (click)="logout()">Salir</button>
          </div>
        </header>

        <router-outlet />
      </main>
    </div>
  `
})
export class ShellComponent {
  constructor(private readonly router: Router) {}

  logout() {
    localStorage.removeItem('akri_token');
    localStorage.removeItem('akri_user');
    void this.router.navigate(['/login']);
  }
}
