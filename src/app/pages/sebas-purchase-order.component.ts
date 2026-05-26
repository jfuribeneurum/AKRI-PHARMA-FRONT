import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

interface OrderItem {
  id_producto: number;
  codigo: string;
  nombre: string;
  laboratorio: string;
  cantidad: number;
  valor_unitario: number;
}

@Component({
  selector: 'akri-sebas-purchase-order',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    /* ── filtros ─────────────────────────────────────────────── */
    .filter-type-row { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.85rem; }
    .filter-pill {
      padding: 0.35rem 1rem; border-radius: 99px; font-size: 0.82rem; font-weight: 600;
      border: 1.5px solid var(--color-border, #d1d5db); background: var(--color-surface, #fff);
      cursor: pointer; color: inherit; transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .filter-pill:hover { border-color: var(--color-primary, #2563eb); color: var(--color-primary, #2563eb); }
    .filter-pill.active { background: var(--color-primary, #2563eb); color: #fff; border-color: var(--color-primary, #2563eb); }
    .filter-input-row { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: flex-end; }
    .filter-input-row label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.8rem; font-weight: 600; flex: 1; min-width: 160px; }
    .filter-input-row input { padding: 0.45rem 0.65rem; border: 1px solid var(--color-border, #d1d5db); border-radius: 6px; font-size: 0.88rem; background: var(--color-surface, #fff); color: inherit; width: 100%; }
    .filter-input-row input:focus { outline: 2px solid var(--color-primary, #2563eb); outline-offset: -1px; }
    .filter-btn { padding: 0.45rem 1rem; font-size: 0.85rem; }

    /* ── tabla órdenes ───────────────────────────────────────── */
    .orders-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    .orders-table th { background: var(--color-surface-2, #f3f4f6); padding: 0.55rem 0.75rem; text-align: left; font-weight: 600; font-size: 0.78rem; white-space: nowrap; }
    .orders-table td { padding: 0.45rem 0.75rem; border-bottom: 1px solid var(--color-border, #e5e7eb); }
    .orders-table tr:last-child td { border-bottom: none; }
    .badge { display: inline-block; padding: 0.15rem 0.55rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; }
    .badge-borrador { background: #fef3c7; color: #92400e; }
    .badge-aprobada { background: #d1fae5; color: #065f46; }
    .empty-row td { text-align: center; color: #9ca3af; padding: 1.5rem; }

    /* ── secciones del formulario ────────────────────────────── */
    .po-section { margin-bottom: 1.5rem; }
    .po-section-title {
      font-size: 0.78rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--color-primary, #2563eb);
      border-bottom: 2px solid var(--color-primary, #2563eb);
      padding-bottom: 0.35rem; margin-bottom: 1rem;
    }

    /* ── tabla de items ──────────────────────────────────────── */
    .items-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    .items-table th { background: var(--color-surface-2, #f3f4f6); padding: 0.5rem 0.6rem; text-align: left; font-weight: 600; font-size: 0.78rem; white-space: nowrap; }
    .items-table td { padding: 0.35rem 0.4rem; border-bottom: 1px solid var(--color-border, #e5e7eb); vertical-align: middle; }
    .items-table input { width: 100%; min-width: 0; padding: 0.3rem 0.45rem; border: 1px solid var(--color-border, #d1d5db); border-radius: 4px; font-size: 0.85rem; background: var(--color-surface, #fff); color: inherit; }
    .items-table input:focus { outline: 2px solid var(--color-primary, #2563eb); outline-offset: -1px; }
    .total-row td { font-weight: 700; background: var(--color-surface-2, #f9fafb); padding: 0.5rem 0.6rem; }
    .valor-total-cell { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .btn-remove { background: none; border: none; color: #ef4444; cursor: pointer; font-size: 1rem; padding: 0 0.3rem; line-height: 1; }
    .btn-remove:hover { color: #b91c1c; }

    /* ── separador nueva orden ───────────────────────────────── */
    .new-order-toggle {
      display: flex; align-items: center; gap: 0.75rem; cursor: pointer;
      user-select: none; padding: 0.6rem 0; margin-bottom: 1rem;
    }
    .new-order-toggle h3 { margin: 0; font-size: 1rem; }
    .toggle-arrow { font-size: 0.8rem; color: #6b7280; transition: transform 0.2s; }
    .toggle-arrow.open { transform: rotate(90deg); }
  `],
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Ordenes de Compra</h1>
        </div>
        <div class="toolbar" style="margin-bottom:0">
          <button class="btn secondary" (click)="loadOrders()">Actualizar</button>
        </div>
      </div>

      @if (message()) { <div class="success-box">{{ message() }}</div> }
      @if (error()) { <div class="error-box">{{ error() }}</div> }

      <!-- ══ BUSCADOR ════════════════════════════════════════════════ -->
      <div class="card">
        <div class="po-section-title">Buscar ordenes</div>

        <!-- selector de tipo de filtro -->
        <div class="filter-type-row">
          <button class="filter-pill" [class.active]="filterType() === 'numero'"
            (click)="setFilterType('numero')">Numero de orden</button>
          <button class="filter-pill" [class.active]="filterType() === 'fecha'"
            (click)="setFilterType('fecha')">Fecha</button>
          <button class="filter-pill" [class.active]="filterType() === 'laboratorio'"
            (click)="setFilterType('laboratorio')">Laboratorio</button>
        </div>

        <!-- input segun el tipo activo -->
        <div class="filter-input-row">
          @if (filterType() === 'numero') {
            <label>
              Numero de orden
              <input [(ngModel)]="filter.numero_oc" placeholder="OC-..." (ngModelChange)="applyFilter()">
            </label>
          }
          @if (filterType() === 'fecha') {
            <label>
              Desde
              <input type="date" [(ngModel)]="filter.fecha_desde" (ngModelChange)="applyFilter()">
            </label>
            <label>
              Hasta
              <input type="date" [(ngModel)]="filter.fecha_hasta" (ngModelChange)="applyFilter()">
            </label>
          }
          @if (filterType() === 'laboratorio') {
            <label>
              Laboratorio
              <input [(ngModel)]="filter.laboratorio" placeholder="Nombre del laboratorio" (ngModelChange)="applyFilter()">
            </label>
          }
          <button class="btn secondary filter-btn" style="align-self:flex-end" (click)="clearFilter()">Limpiar</button>
        </div>

        <div style="overflow-x:auto;">
          <table class="orders-table">
            <thead>
              <tr>
                <th>Consecutivo</th>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Sede</th>
                <th>Estado</th>
                <th style="text-align:right">Total</th>
              </tr>
            </thead>
            <tbody>
              @if (loading()) {
                <tr class="empty-row"><td colspan="6">Cargando...</td></tr>
              } @else if (filtered().length === 0) {
                <tr class="empty-row"><td colspan="6">No se encontraron ordenes.</td></tr>
              } @else {
                @for (row of filtered(); track row.id_oc) {
                  <tr>
                    <td>{{ row.numero_oc }}</td>
                    <td>{{ row.fecha | date:'dd/MM/yyyy' }}</td>
                    <td>{{ row.proveedor }}</td>
                    <td>{{ row.sede }}</td>
                    <td>
                      <span class="badge" [class.badge-borrador]="row.estado === 'borrador'" [class.badge-aprobada]="row.estado === 'aprobada'">
                        {{ row.estado }}
                      </span>
                    </td>
                    <td style="text-align:right">{{ row.total | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
        <div style="margin-top:0.5rem; font-size:0.8rem; color:#9ca3af">
          {{ filtered().length }} de {{ allOrders().length }} ordenes
        </div>
      </div>

      <!-- ══ FORMULARIO NUEVA ORDEN ══════════════════════════════════ -->
      <div class="card">
        <div class="new-order-toggle" (click)="showForm.set(!showForm())">
          <span class="toggle-arrow" [class.open]="showForm()">&#9654;</span>
          <h3>Nueva orden de compra</h3>
        </div>

        @if (showForm()) {

          <!-- 1. ENCABEZADO -->
          <div class="po-section">
            <div class="po-section-title">Encabezado</div>
            <div class="form-grid">
              <label>
                Consecutivo
                <input [(ngModel)]="order.consecutivo">
              </label>
              <label>
                Fecha
                <input type="date" [(ngModel)]="order.fecha">
              </label>
            </div>
          </div>

          <!-- 2. DATOS DE LA SEDE -->
          <div class="po-section">
            <div class="po-section-title">Datos de la sede</div>
            <div class="form-grid">
              <label>
                Sede
                <input [(ngModel)]="order.sede" placeholder="Nombre de la sede">
              </label>
              <label>
                Bodega
                <input [(ngModel)]="order.bodega" placeholder="Bodega de destino">
              </label>
              <label>
                Direccion
                <input [(ngModel)]="order.direccion_sede" placeholder="Direccion de la sede">
              </label>
              <label>
                Ciudad
                <input [(ngModel)]="order.ciudad_sede" placeholder="Ciudad">
              </label>
            </div>
          </div>

          <!-- 3. DATOS DEL PROVEEDOR -->
          <div class="po-section">
            <div class="po-section-title">Datos del proveedor</div>
            <div class="form-grid">
              <label>
                Nombre
                <input [(ngModel)]="order.proveedor_nombre" placeholder="Nombre del proveedor">
              </label>
              <label>
                NIT
                <input [(ngModel)]="order.proveedor_nit">
              </label>
              <label>
                Contacto
                <input [(ngModel)]="order.proveedor_contacto">
              </label>
              <label>
                Telefono
                <input [(ngModel)]="order.proveedor_telefono">
              </label>
              <label class="full">
                Direccion proveedor
                <input [(ngModel)]="order.proveedor_direccion">
              </label>
            </div>
          </div>

          <!-- 4. DETALLE -->
          <div class="po-section">
            <div class="po-section-title">Detalle</div>
            <div style="overflow-x:auto;">
              <table class="items-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Codigo</th>
                    <th>Nombre</th>
                    <th>Laboratorio</th>
                    <th style="text-align:right">Cantidad</th>
                    <th style="text-align:right">Valor unitario</th>
                    <th style="text-align:right">Valor total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of items; track $index) {
                    <tr>
                      <td style="color:#9ca3af; font-size:0.8rem;">{{ $index + 1 }}</td>
                      <td><input [(ngModel)]="item.codigo" placeholder="Cod."></td>
                      <td><input [(ngModel)]="item.nombre" placeholder="Nombre del producto"></td>
                      <td><input [(ngModel)]="item.laboratorio" placeholder="Laboratorio"></td>
                      <td><input type="number" min="0" [(ngModel)]="item.cantidad" style="text-align:right;width:80px"></td>
                      <td><input type="number" min="0" [(ngModel)]="item.valor_unitario" style="text-align:right;width:110px"></td>
                      <td class="valor-total-cell">{{ itemTotal(item) | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                      <td>
                        @if (items.length > 1) {
                          <button class="btn-remove" (click)="removeItem($index)" title="Eliminar fila">&times;</button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr class="total-row">
                    <td colspan="6" style="text-align:right">Total</td>
                    <td class="valor-total-cell">{{ grandTotal() | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <button class="btn btn-outline" style="margin-top:0.6rem" (click)="addItem()">+ Agregar item</button>
          </div>

          <!-- OBSERVACIONES -->
          <div class="po-section">
            <div class="form-grid">
              <label class="full">
                Observaciones
                <textarea [(ngModel)]="order.observaciones" placeholder="Condiciones, notas o instrucciones especiales"></textarea>
              </label>
            </div>
          </div>

          <button class="btn" (click)="createPurchase()" [disabled]="saving()">
            {{ saving() ? 'Guardando...' : 'Crear orden de compra' }}
          </button>

        }
      </div>
    </section>
  `
})
export class SebasPurchaseOrderComponent implements OnInit {
  readonly message = signal('');
  readonly error = signal('');
  readonly saving = signal(false);
  readonly loading = signal(false);
  readonly showForm = signal(false);
  readonly allOrders = signal<any[]>([]);
  readonly filtered = signal<any[]>([]);

  readonly filterType = signal<'numero' | 'fecha' | 'laboratorio'>('numero');
  filter = { numero_oc: '', fecha_desde: '', fecha_hasta: '', laboratorio: '' };

  setFilterType(type: 'numero' | 'fecha' | 'laboratorio') {
    this.filterType.set(type);
    this.filter = { numero_oc: '', fecha_desde: '', fecha_hasta: '', laboratorio: '' };
    this.applyFilter();
  }

  order: any = {
    consecutivo: `OC-${Date.now()}`,
    fecha: new Date().toISOString().slice(0, 10),
    sede: '',
    bodega: '',
    direccion_sede: '',
    ciudad_sede: '',
    proveedor_nombre: '',
    proveedor_nit: '',
    proveedor_contacto: '',
    proveedor_telefono: '',
    proveedor_direccion: '',
    observaciones: ''
  };

  items: OrderItem[] = [
    { id_producto: 0, codigo: '', nombre: '', laboratorio: '', cantidad: 0, valor_unitario: 0 }
  ];

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    this.loadOrders();
  }

  async loadOrders() {
    this.loading.set(true);
    try {
      const data = await this.api.get<any[]>('/purchases');
      this.allOrders.set(data ?? []);
      this.applyFilter();
    } catch {
      /* silencioso — el usuario puede reintentar con Actualizar */
    } finally {
      this.loading.set(false);
    }
  }

  applyFilter() {
    const num = this.filter.numero_oc.toLowerCase().trim();
    const desde = this.filter.fecha_desde.trim();
    const hasta = this.filter.fecha_hasta.trim();
    const lab = this.filter.laboratorio.toLowerCase().trim();

    this.filtered.set(
      this.allOrders().filter(row => {
        if (num && !String(row.numero_oc ?? '').toLowerCase().includes(num)) return false;
        if (desde && String(row.fecha ?? '') < desde) return false;
        if (hasta && String(row.fecha ?? '') > hasta) return false;
        if (lab && !String(row.observaciones ?? '').toLowerCase().includes(lab)) return false;
        return true;
      })
    );
  }

  clearFilter() {
    this.filter = { numero_oc: '', fecha_desde: '', fecha_hasta: '', laboratorio: '' };
    this.applyFilter();
  }

  itemTotal(item: OrderItem): number {
    return (item.cantidad ?? 0) * (item.valor_unitario ?? 0);
  }

  grandTotal(): number {
    return this.items.reduce((sum, item) => sum + this.itemTotal(item), 0);
  }

  addItem() {
    this.items.push({ id_producto: 0, codigo: '', nombre: '', laboratorio: '', cantidad: 0, valor_unitario: 0 });
  }

  removeItem(index: number) {
    this.items.splice(index, 1);
  }

  async createPurchase() {
    this.error.set('');
    this.message.set('');
    this.saving.set(true);
    try {
      await this.api.post('/purchases', this.buildPayload());
      this.message.set('Orden de compra creada correctamente.');
      await this.loadOrders();
    } catch (err: any) {
      this.error.set(err?.error?.message || 'No fue posible crear la orden de compra.');
    } finally {
      this.saving.set(false);
    }
  }

  private buildPayload() {
    const itemLines = this.items
      .filter(i => i.cantidad > 0)
      .map((i, idx) =>
        `Item ${idx + 1}: codigo=${i.codigo} | nombre=${i.nombre} | laboratorio=${i.laboratorio} | cantidad=${i.cantidad} | valor_unitario=${i.valor_unitario}`
      )
      .join('\n');

    const meta = [
      `Sede: ${this.order.sede}`,
      `Bodega: ${this.order.bodega}`,
      `Direccion sede: ${this.order.direccion_sede}`,
      `Ciudad: ${this.order.ciudad_sede}`,
      `Proveedor: ${this.order.proveedor_nombre}`,
      `NIT: ${this.order.proveedor_nit}`,
      `Contacto: ${this.order.proveedor_contacto}`,
      `Telefono: ${this.order.proveedor_telefono}`,
      `Direccion proveedor: ${this.order.proveedor_direccion}`,
      `Total OC: ${this.grandTotal()}`
    ].filter(line => !line.endsWith(': ')).join('\n');

    const notes = [this.order.observaciones?.trim(), itemLines, meta]
      .filter(Boolean)
      .join('\n\n');

    return {
      numero_oc: this.order.consecutivo,
      id_proveedor: 1,
      estado: 'borrador',
      observaciones: notes,
      items: this.items
        .filter(i => i.cantidad > 0)
        .map(i => ({
          id_producto: Number(i.id_producto) || 1,
          cantidad: Number(i.cantidad),
          precio_unitario: Number(i.valor_unitario),
          descuento: 0,
          impuesto: 0,
          fecha_requerida: null
        }))
    };
  }
}
