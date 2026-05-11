import { Component, ElementRef, ViewChild } from '@angular/core';
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

        <nav
          #sidebarNav
          class="sidebar-nav"
          [class.dragging]="isDraggingNav"
          (pointerdown)="startNavDrag($event)"
          (pointermove)="dragNav($event)"
          (pointerup)="stopNavDrag($event)"
          (pointercancel)="stopNavDrag($event)"
          (pointerleave)="stopNavDrag($event)"
        >
          <a *ngFor="let item of visibleNavItems()" [routerLink]="item.path" routerLinkActive="active">{{ item.label }}</a>
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
  @ViewChild('sidebarNav') private readonly sidebarNav?: ElementRef<HTMLElement>;

  isDraggingNav = false;
  private dragStartY = 0;
  private dragStartScroll = 0;

  constructor(private readonly router: Router) {}

  readonly navItems = [
    { path: '/dashboard', label: 'Dashboard', any: [] },
    { path: '/products', label: 'Productos e imágenes', any: ['perm_inventario_consulta', 'perm_inventario_movimiento'] },
    { path: '/ingresos', label: 'Ingresos', any: ['perm_inventario_movimiento', 'perm_compras_recibir'] },
    { path: '/sebas-ingresos', label: 'Ingresos Sebas', any: ['perm_inventario_movimiento', 'perm_compras_recibir'] },
    { path: '/inventory', label: 'Inventario y escaneo', any: ['perm_inventario_consulta'] },
    { path: '/providers', label: 'Proveedores', any: ['perm_compras_solicitar', 'perm_compras_aprobar', 'perm_compras_recibir'] },
    { path: '/purchases', label: 'Compras', any: ['perm_compras_solicitar', 'perm_compras_aprobar', 'perm_compras_recibir'] },
    { path: '/sebas-purchase-order', label: 'Orden de compra Sebas', any: ['perm_compras_solicitar', 'perm_compras_aprobar'] },
    { path: '/sales', label: 'Ventas', any: ['perm_ventas_dispensar', 'perm_ventas_facturar'] },
    { path: '/dispensing', label: 'Dispensación', any: ['perm_ventas_dispensar', 'perm_controlados_dispensar'] },
    { path: '/dispensing-sebas', label: 'Dispensación Sebas', any: ['perm_ventas_dispensar', 'perm_controlados_dispensar'] },
    { path: '/cold-chain', label: 'Cadena de frío', any: ['perm_cadena_frio_consulta', 'perm_cadena_frio_registro'] },
    { path: '/billing', label: 'Facturación', any: ['perm_ventas_facturar', 'perm_reportes_financieros'] },
    { path: '/reports', label: 'Reportes y exportación', any: ['perm_reportes_operativos', 'perm_reportes_financieros'] },
    { path: '/admin', label: 'Administración', any: ['perm_usuarios_gestionar', 'perm_configuracion'] },
    { path: '/settings', label: 'SIESA / Config', any: ['perm_configuracion'] }
  ];

  visibleNavItems() {
    const user = this.currentUser();
    if (user?.role === 'ADMINISTRADOR') {
      return this.navItems;
    }
    const permissions = user?.permissions ?? {};
    return this.navItems.filter((item) => !item.any.length || item.any.some((key) => Boolean(permissions[key])));
  }

  private currentUser(): any {
    try {
      return JSON.parse(localStorage.getItem('akri_user') ?? 'null');
    } catch (_error) {
      return null;
    }
  }

  logout() {
    localStorage.removeItem('akri_token');
    localStorage.removeItem('akri_user');
    void this.router.navigate(['/login']);
  }

  startNavDrag(event: PointerEvent) {
    const nav = this.sidebarNav?.nativeElement;
    if (!nav) return;
    if ((event.target as HTMLElement).closest('a')) return;
    this.isDraggingNav = true;
    this.dragStartY = event.clientY;
    this.dragStartScroll = nav.scrollTop;
    nav.setPointerCapture(event.pointerId);
  }

  dragNav(event: PointerEvent) {
    const nav = this.sidebarNav?.nativeElement;
    if (!this.isDraggingNav || !nav) return;
    event.preventDefault();
    nav.scrollTop = this.dragStartScroll - (event.clientY - this.dragStartY);
  }

  stopNavDrag(event?: PointerEvent) {
    const nav = this.sidebarNav?.nativeElement;
    if (event && nav?.hasPointerCapture(event.pointerId)) {
      nav.releasePointerCapture(event.pointerId);
    }
    this.isDraggingNav = false;
  }
}
