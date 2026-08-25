import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { ThemeService } from '../core/theme.service';
import { SiteContextService } from '../core/site-context.service';

@Component({
  selector: 'akri-shell',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="layout">
      <aside class="sidebar">
        <div class="brand">AkriPharmacy</div>

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
          <ng-container *ngFor="let item of visibleItems">
            <a *ngIf="!item.children && !item.comingSoon" [routerLink]="item.path" routerLinkActive="active">{{ item.label }}</a>
            <button *ngIf="!item.children && item.comingSoon" class="nav-soon-btn" type="button" (click)="openComingSoon()">
              {{ item.label }}
              <span class="badge-soon">Próximamente</span>
            </button>

            <div class="nav-group" *ngIf="item.children">
              <a class="nav-group-toggle"
                 (click)="item.pinProtected && !item.unlocked ? openPin(item) : toggleGroup(item)"
                 [class.expanded]="item.expanded">
                {{ item.label }}
                <span *ngIf="item.pinProtected && !item.unlocked" class="nav-lock">🔒</span>
                <span *ngIf="!item.pinProtected || item.unlocked" class="chevron" [class.rotated]="item.expanded">▼</span>
              </a>
              <div class="nav-group-items" *ngIf="item.expanded && (!item.pinProtected || item.unlocked)">
                <ng-container *ngFor="let child of item.children">
                  <a *ngIf="!child.comingSoon" [routerLink]="child.path" routerLinkActive="active">{{ child.label }}</a>
                  <button *ngIf="child.comingSoon" class="nav-soon-btn" type="button" (click)="openComingSoon()">
                    {{ child.label }}
                    <span class="badge-soon">Próximamente</span>
                  </button>
                </ng-container>
              </div>
            </div>
          </ng-container>
        </nav>
      </aside>

      <main class="content">
        <header class="topbar">
          <div></div>
          <div class="topbar-actions">
            @if (siteContext.almacenes().length > 1) {
              <select class="chip primary chip-select"
                      [ngModel]="siteContext.activeAlmacenId()"
                      (ngModelChange)="onAlmacenChange($event)"
                      title="Cambiar almacén activo">
                @for (a of siteContext.almacenes(); track a.id_almacen) {
                  <option [value]="a.id_almacen">{{ a.nombre }}</option>
                }
              </select>
            } @else {
              <span class="chip primary">{{ siteContext.almacenes().at(0)?.nombre ?? 'Multisede' }}</span>
            }
            <span class="chip info">Termohigrómetros</span>
            <span class="chip accent">Dispensación</span>
            <button class="btn secondary" (click)="logout()">Salir</button>
            <button
              class="theme-toggle"
              (click)="theme.toggle()"
              [title]="isDark ? 'Modo claro' : 'Modo oscuro'"
            >
              @if (isDark) {
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              } @else {
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              }
            </button>
          </div>
        </header>

        <router-outlet />
      </main>
    </div>

    <!-- PIN Modal -->
    <div class="pin-overlay" *ngIf="pinVisible" (click)="closePin()">
      <div class="pin-modal" (click)="$event.stopPropagation()">
        <span class="pin-icon">🔒</span>
        <h3 class="pin-title">Acceso restringido</h3>
        <p class="pin-body">Ingresa la clave para ver <strong>{{ pendingPinGroup?.label }}</strong></p>
        <input
          #pinInput
          type="password"
          class="pin-input"
          maxlength="4"
          placeholder="••••"
          (keydown.enter)="submitPin(pinInput.value)"
          (input)="pinError = false"
        >
        <p class="pin-error-msg" *ngIf="pinError">Clave incorrecta. Intenta de nuevo.</p>
        <div class="pin-actions">
          <button class="pin-btn-cancel" (click)="closePin()">Cancelar</button>
          <button class="pin-btn-ok" (click)="submitPin(pinInput.value)">Ingresar</button>
        </div>
      </div>
    </div>

    <!-- Coming Soon Modal -->
    <div class="coming-soon-overlay" *ngIf="comingSoonVisible" (click)="closeComingSoon()">
      <div class="coming-soon-modal" (click)="$event.stopPropagation()">
        <span class="cs-icon">🚀</span>
        <h2 class="cs-title">¡Próximamente!</h2>
        <p class="cs-body">
          Estamos construyendo algo increíble para ti.<br>
          El módulo de <strong>Inventario y Escaneo</strong> estará
          completamente funcional muy pronto, con control de stock,
          ingresos, movimientos y trazabilidad integrada.
        </p>
        <p class="cs-sub">Gracias por tu paciencia. ¡Grandes cosas vienen en camino!</p>
        <button class="cs-btn" (click)="closeComingSoon()">Entendido</button>
      </div>
    </div>
  `
})
export class ShellComponent {
  @ViewChild('sidebarNav') private readonly sidebarNav?: ElementRef<HTMLElement>;

  isDraggingNav = false;
  private dragStartY = 0;
  private dragStartScroll = 0;

  visibleItems: any[] = [];
  comingSoonVisible = false;

  pinVisible = false;
  pendingPinGroup: any = null;
  pinError = false;

  isDark = false;

  constructor(private readonly router: Router, readonly theme: ThemeService, readonly siteContext: SiteContextService) {
    this.visibleItems = this.computeVisibleNavItems();
    this.theme.isDark$.subscribe(v => this.isDark = v);
    void this.siteContext.init();
  }

  onAlmacenChange(id: number | string) {
    void this.siteContext.switchAlmacen(Number(id)).then(() => window.location.reload());
  }

  readonly navItems: any[] = [
    { path: '/dashboard', label: 'Dashboard', any: [] },
    {
      label: 'Listados',
      any: [],
      expanded: false,
      children: [
        { path: '/maestro-mx', label: 'Maestro MX', any: [] },
        { path: '/laboratorios', label: 'Laboratorios', any: [] },
        { path: '/providers', label: 'Proveedores', any: ['perm_compras_solicitar', 'perm_compras_aprobar', 'perm_compras_recibir'] },
        { path: '/pacientes', label: 'Pacientes', any: [] },
        { path: '/bodegas', label: 'Bodegas', any: [] },
        { path: '/ciudades', label: 'Ciudades', any: [] },
        { path: '/parametros', label: 'Parámetros del sistema', any: [] }
      ]
    },
    {
      label: 'Compras',
      any: [],
      expanded: false,
      children: [
        { path: '/sebas-purchase-order', label: 'Orden de compra Sebas', any: ['perm_compras_solicitar', 'perm_compras_aprobar'] },
        { path: '/sebas-ingresos', label: 'Ingresos Sebas', any: ['perm_inventario_movimiento', 'perm_compras_recibir'] },
        { path: '/devolucion-pedido', label: 'Devolución pedido', any: [] },
        { path: '/alertas-entrega', label: 'Alertas pendientes de entrega', any: [] }
      ]
    },
    {
      label: 'Movimientos',
      any: [],
      expanded: false,
      children: [
        { path: '/salida', label: 'Salida', any: [] },
        { path: '/entrada', label: 'Entrada', any: [] },
        { path: '/traslados', label: 'Traslados', any: [] },
        { path: '/consumo-dispositivos', label: 'Consumo dispositivos', any: [] }
      ]
    },
    { path: '/dispensing-sebas', label: 'Dispensación Sebas', any: ['perm_ventas_dispensar', 'perm_controlados_dispensar'] },
    {
      label: 'Otros',
      any: [],
      expanded: false,
      pinProtected: true,
      unlocked: false,
      children: [
        { path: '/products',    label: 'Productos e imágenes',       any: ['perm_inventario_consulta', 'perm_inventario_movimiento'] },
        { path: '/ingresos',    label: 'Ingreso pedido',             any: ['perm_inventario_movimiento', 'perm_compras_recibir'] },
        { path: '/inventory',   label: 'Inventario y escaneo',       any: ['perm_inventario_consulta'], comingSoon: true },
        { path: '/purchases',   label: 'Orden de compra',            any: ['perm_compras_solicitar', 'perm_compras_aprobar', 'perm_compras_recibir'] },
        { path: '/sales',       label: 'Ventas',                     any: ['perm_ventas_dispensar', 'perm_ventas_facturar'] },
        { path: '/dispensing',  label: 'Dispensación',               any: ['perm_ventas_dispensar', 'perm_controlados_dispensar'] },
        { path: '/cold-chain',  label: 'Cadena de frío',             any: ['perm_cadena_frio_consulta', 'perm_cadena_frio_registro'] },
        { path: '/billing',     label: 'Facturación',                any: ['perm_ventas_facturar', 'perm_reportes_financieros'] },
        { path: '/reports',     label: 'Reportes y exportación',     any: ['perm_reportes_operativos', 'perm_reportes_financieros'] },
        { path: '/admin',       label: 'Administración',             any: ['perm_usuarios_gestionar', 'perm_configuracion'] },
        { path: '/settings',    label: 'SIESA / Config',             any: ['perm_configuracion'] },
        { path: '/trazabilidad',label: 'Trazabilidad',               any: ['perm_usuarios_gestionar', 'perm_configuracion', 'perm_reportes_operativos'] },
        { path: '/pacientes',   label: 'Pacientes HealthSphere',     any: [] },
      ]
    },
  ];

  computeVisibleNavItems() {
    const user = this.currentUser();
    const isAdmin = user?.role === 'ADMINISTRADOR';
    const permissions = user?.permissions ?? {};

    return this.navItems.map(item => {
      if (item.children) {
        const visibleChildren = isAdmin ? item.children : item.children.filter((child: any) => !child.any.length || child.any.some((key: string) => Boolean(permissions[key])));
        return { ...item, children: visibleChildren };
      }
      return { ...item };
    }).filter(item => {
      if (item.children) return item.children.length > 0;
      return isAdmin || !item.any.length || item.any.some((key: string) => Boolean(permissions[key]));
    });
  }

  openComingSoon() {
    this.comingSoonVisible = true;
  }

  closeComingSoon() {
    this.comingSoonVisible = false;
  }

  openPin(group: any) {
    this.pendingPinGroup = group;
    this.pinVisible = true;
    this.pinError = false;
  }

  closePin() {
    this.pinVisible = false;
    this.pendingPinGroup = null;
    this.pinError = false;
  }

  submitPin(value: string) {
    if (value === '8888') {
      this.pendingPinGroup.unlocked = true;
      this.pendingPinGroup.expanded = true;
      this.closePin();
    } else {
      this.pinError = true;
    }
  }

  toggleGroup(item: any) {
    item.expanded = !item.expanded;
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
