import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'akri-sebas-ingresos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    /* filtros */
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
    /* botones modo */
    .modo-btn {
      padding: 0.5rem 1.5rem; border-radius: 8px; font-size: 0.9rem; font-weight: 600;
      border: 2px solid var(--color-border, #d1d5db); background: var(--color-surface, #fff);
      cursor: pointer; color: inherit; transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .modo-btn:hover { border-color: var(--color-primary, #2563eb); color: var(--color-primary, #2563eb); }
    .modo-btn.active { background: var(--color-primary, #2563eb); color: #fff; border-color: var(--color-primary, #2563eb); }
    /* buscador de orden */
    .oc-search-input {
      width: 100%; padding: 0.55rem 0.85rem; border: 1.5px solid var(--color-border, #d1d5db);
      border-radius: 8px; font-size: 0.92rem; background: var(--color-surface, #fff); color: inherit;
      margin-bottom: 0.85rem;
    }
    .oc-search-input:focus { outline: 2px solid var(--color-primary, #2563eb); outline-offset: -1px; }
    .oc-list { display: flex; flex-direction: column; gap: 0.4rem; max-height: 280px; overflow-y: auto; }
    .oc-item {
      display: flex; align-items: center; justify-content: space-between; gap: 1rem;
      padding: 0.6rem 0.9rem; border: 1.5px solid var(--color-border, #e5e7eb);
      border-radius: 8px; cursor: pointer; background: var(--color-surface, #fff);
      transition: border-color 0.15s, background 0.15s;
    }
    .oc-item:hover { border-color: var(--color-primary, #2563eb); background: #eff6ff; }
    .oc-item.selected { border-color: var(--color-primary, #2563eb); background: #eff6ff; }
    .oc-item-main { display: flex; flex-direction: column; gap: 0.15rem; }
    .oc-numero { font-weight: 700; font-size: 0.9rem; }
    .oc-meta { font-size: 0.78rem; color: #6b7280; }
    .oc-badge { font-size: 0.72rem; font-weight: 600; padding: 0.15rem 0.5rem; border-radius: 99px; white-space: nowrap; }
    .badge-borrador { background: #fef3c7; color: #92400e; }
    .badge-aprobada { background: #d1fae5; color: #065f46; }
    /* orden seleccionada */
    .selected-banner {
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;
      padding: 0.65rem 1rem; background: #eff6ff; border: 1.5px solid var(--color-primary, #2563eb);
      border-radius: 8px; margin-bottom: 1rem; font-size: 0.88rem;
    }
    .selected-banner strong { color: var(--color-primary, #2563eb); }
    .btn-deselect { background: none; border: none; color: #ef4444; cursor: pointer; font-size: 1rem; font-weight: 700; padding: 0 0.25rem; }
    /* secciones */
    .po-section { margin-bottom: 1.5rem; }
    .po-section-title {
      font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
      color: var(--color-primary, #2563eb); border-bottom: 2px solid var(--color-primary, #2563eb);
      padding-bottom: 0.35rem; margin-bottom: 1rem;
    }
    /* tabla items */
    .items-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    .items-table th { background: var(--color-surface-2, #f3f4f6); padding: 0.5rem 0.6rem; text-align: left; font-weight: 600; font-size: 0.78rem; white-space: nowrap; }
    .items-table td { padding: 0.35rem 0.4rem; border-bottom: 1px solid var(--color-border, #e5e7eb); vertical-align: middle; }
    .items-table input { width: 100%; min-width: 0; padding: 0.3rem 0.45rem; border: 1px solid var(--color-border, #d1d5db); border-radius: 4px; font-size: 0.85rem; background: var(--color-surface, #fff); color: inherit; }
    .items-table input:focus { outline: 2px solid var(--color-primary, #2563eb); outline-offset: -1px; }
    .total-row td { font-weight: 700; background: var(--color-surface-2, #f9fafb); padding: 0.5rem 0.6rem; }
    .valor-total-cell { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    /* tabla campos clave-valor */
    .fields-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    .fields-table th { background: var(--color-surface-2, #f3f4f6); padding: 0.5rem 0.75rem; text-align: left; font-weight: 600; font-size: 0.78rem; white-space: nowrap; width: 220px; border-bottom: 1px solid var(--color-border, #e5e7eb); }
    .fields-table td { padding: 0.35rem 0.5rem; border-bottom: 1px solid var(--color-border, #e5e7eb); vertical-align: middle; }
    .fields-table tr:last-child th, .fields-table tr:last-child td { border-bottom: none; }
    .fields-table input, .fields-table textarea { width: 100%; padding: 0.3rem 0.45rem; border: 1px solid var(--color-border, #d1d5db); border-radius: 4px; font-size: 0.85rem; background: var(--color-surface, #fff); color: inherit; }
    .fields-table input:focus, .fields-table textarea:focus { outline: 2px solid var(--color-primary, #2563eb); outline-offset: -1px; }
    .fields-table textarea { min-height: 64px; resize: vertical; }
  `],
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Ingresos Sebas</h1>
          <p class="page-subtitle">Registro de ingreso con datos de factura, proveedor, producto, lote y valores.</p>
        </div>
      </div>

      @if (message()) { <div class="success-box">{{ message() }}</div> }
      @if (error()) { <div class="error-box">{{ error() }}</div> }

      <!-- ══ BUSCADOR DE INGRESOS ══════════════════════════════════ -->
      <div class="card">
        <div class="po-section-title">Buscar ingresos</div>

        <div class="filter-type-row">
          <button class="filter-pill" [class.active]="filterType() === 'numero'"
            (click)="setFilterType('numero')">Numero de orden</button>
          <button class="filter-pill" [class.active]="filterType() === 'fecha'"
            (click)="setFilterType('fecha')">Fecha</button>
          <button class="filter-pill" [class.active]="filterType() === 'laboratorio'"
            (click)="setFilterType('laboratorio')">Laboratorio</button>
        </div>

        <div class="filter-input-row">
          @if (filterType() === 'numero') {
            <label>Numero de orden<input [(ngModel)]="filter.numero_oc" placeholder="OC-..."></label>
          }
          @if (filterType() === 'fecha') {
            <label>Desde<input type="date" [(ngModel)]="filter.fecha_desde"></label>
            <label>Hasta<input type="date" [(ngModel)]="filter.fecha_hasta"></label>
          }
          @if (filterType() === 'laboratorio') {
            <label>Laboratorio<input [(ngModel)]="filter.laboratorio" placeholder="Nombre del laboratorio"></label>
          }
          <button class="btn secondary" style="align-self:flex-end;padding:0.45rem 1rem;font-size:0.85rem" (click)="clearFilter()">Limpiar</button>
        </div>

        <div style="display:flex;gap:0.75rem;margin-top:1.25rem;flex-wrap:wrap;">
          <button class="modo-btn" [class.active]="modo() === 'con_orden'" (click)="activarConOrden()">Con orden</button>
          <button class="modo-btn" [class.active]="modo() === 'sin_orden'" (click)="activarSinOrden()">Sin orden</button>
        </div>
      </div>

      <!-- ══ SELECCIONAR ORDEN DE COMPRA ═══════════════════════════ -->
      @if (modo() === 'con_orden') {
        <div class="card">
          <div class="po-section-title">Seleccionar orden de compra</div>

          @if (ordenSeleccionada()) {
            <div class="selected-banner">
              <span>
                Orden seleccionada: <strong>{{ ordenSeleccionada()!.numero_oc }}</strong>
                &nbsp;&mdash;&nbsp;{{ ordenSeleccionada()!.proveedor }}
                &nbsp;&mdash;&nbsp;{{ ordenSeleccionada()!.fecha | date:'dd/MM/yyyy' }}
              </span>
              <button class="btn-deselect" (click)="deseleccionarOrden()" title="Quitar selección">&times; Cambiar</button>
            </div>
          } @else {
            <input
              class="oc-search-input"
              [(ngModel)]="ocSearch"
              placeholder="Buscar por número de orden o nombre del proveedor..."
              (ngModelChange)="filtrarOrdenes()"
            >
            @if (cargandoOrdenes()) {
              <p style="color:#9ca3af;font-size:0.88rem">Cargando órdenes...</p>
            } @else if (ordenesFiltradas().length === 0 && ocSearch.length > 0) {
              <p style="color:#9ca3af;font-size:0.88rem">No se encontraron órdenes.</p>
            } @else {
              <div class="oc-list">
                @for (oc of ordenesFiltradas(); track oc.id_oc) {
                  <div class="oc-item" (click)="seleccionarOrden(oc)">
                    <div class="oc-item-main">
                      <span class="oc-numero">{{ oc.numero_oc }}</span>
                      <span class="oc-meta">{{ oc.proveedor }} &nbsp;|&nbsp; {{ oc.fecha | date:'dd/MM/yyyy' }}</span>
                    </div>
                    <span class="oc-badge" [class.badge-borrador]="oc.estado==='borrador'" [class.badge-aprobada]="oc.estado==='aprobada'">
                      {{ oc.estado }}
                    </span>
                  </div>
                }
              </div>
            }
          }
        </div>
      }

      <!-- ══ FORMULARIO CON ORDEN ══════════════════════════════════ -->
      @if (modo() === 'con_orden' && ordenSeleccionada()) {
        <div class="card">

          <!-- 1. ENCABEZADO -->
          <div class="po-section">
            <div class="po-section-title">Encabezado</div>
            <div class="form-grid">
              <label>
                Orden de compra
                <input [(ngModel)]="ocMeta.consecutivo" readonly style="background:var(--color-surface-2,#f3f4f6);color:#6b7280">
              </label>
              <label>
                Fecha OC
                <input type="date" [(ngModel)]="ocMeta.fecha" readonly style="background:var(--color-surface-2,#f3f4f6);color:#6b7280">
              </label>
              <label>
                Fecha recepcion
                <input type="date" [(ngModel)]="ingresoExtra.fecha_recepcion">
              </label>
            </div>
          </div>

          <!-- 2. DATOS DE LA SEDE -->
          <div class="po-section">
            <div class="po-section-title">Datos de la sede</div>
            <div class="form-grid">
              <label>Sede<input [(ngModel)]="ocMeta.sede" placeholder="Nombre de la sede"></label>
              <label>Bodega<input [(ngModel)]="ocMeta.bodega" placeholder="Bodega de destino"></label>
              <label>Direccion<input [(ngModel)]="ocMeta.direccion_sede" placeholder="Direccion de la sede"></label>
              <label>Ciudad<input [(ngModel)]="ocMeta.ciudad_sede" placeholder="Ciudad"></label>
            </div>
          </div>

          <!-- 3. DATOS DEL PROVEEDOR -->
          <div class="po-section">
            <div class="po-section-title">Datos del proveedor</div>
            <div class="form-grid">
              <label>Nombre<input [(ngModel)]="ocMeta.proveedor_nombre" placeholder="Nombre del proveedor"></label>
              <label>NIT<input [(ngModel)]="ocMeta.proveedor_nit"></label>
              <label>Contacto<input [(ngModel)]="ocMeta.proveedor_contacto"></label>
              <label>Telefono<input [(ngModel)]="ocMeta.proveedor_telefono"></label>
              <label class="full">Direccion proveedor<input [(ngModel)]="ocMeta.proveedor_direccion"></label>
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
                    <th>Lote</th>
                    <th>Vencimiento</th>
                    <th style="text-align:right">Valor total</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of ocItems; track $index) {
                    <tr>
                      <td style="color:#9ca3af;font-size:0.8rem">{{ $index + 1 }}</td>
                      <td><input [(ngModel)]="item.codigo" placeholder="Cod."></td>
                      <td><input [(ngModel)]="item.nombre" placeholder="Nombre del producto"></td>
                      <td><input [(ngModel)]="item.laboratorio" placeholder="Laboratorio"></td>
                      <td><input type="number" min="0" [(ngModel)]="item.cantidad" style="text-align:right;width:80px"></td>
                      <td><input type="number" min="0" [(ngModel)]="item.valor_unitario" style="text-align:right;width:110px"></td>
                      <td><input [(ngModel)]="item.lote" placeholder="Lote"></td>
                      <td><input type="date" [(ngModel)]="item.fecha_vencimiento"></td>
                      <td class="valor-total-cell">{{ itemTotal(item) | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr class="total-row">
                    <td colspan="8" style="text-align:right">Total</td>
                    <td class="valor-total-cell">{{ grandTotalOc() | currency:'COP':'symbol-narrow':'1.0-0' }}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <!-- 5. DATOS DEL MEDICAMENTO -->
          <div class="po-section">
            <div class="po-section-title">Datos del medicamento</div>
            <div style="overflow-x:auto;">
              <table class="items-table">
                <thead>
                  <tr>
                    <th>Registro Invima MX</th>
                    <th>CUM</th>
                    <th>Consecutivo CUM</th>
                    <th>Presentacion</th>
                    <th>IVA (%)</th>
                    <th>Temperatura</th>
                    <th>Criterio de empleo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><input [(ngModel)]="ingresoExtra.registro_invima" placeholder="INVIMA-..."></td>
                    <td><input [(ngModel)]="ingresoExtra.cum" placeholder="Codigo unico"></td>
                    <td><input [(ngModel)]="ingresoExtra.consecutivo_cum"></td>
                    <td><input [(ngModel)]="ingresoExtra.presentacion" placeholder="Ej: Tabletas x 20"></td>
                    <td><input type="number" min="0" [(ngModel)]="ingresoExtra.iva" style="width:70px"></td>
                    <td><input [(ngModel)]="ingresoExtra.temperatura" placeholder="Ej: 2-8°C"></td>
                    <td><input [(ngModel)]="ingresoExtra.criterio_empleo" placeholder="Condicion de uso"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 6. DATOS DEL INGRESO -->
          <div class="po-section">
            <div class="po-section-title">Datos del ingreso</div>
            <div style="overflow-x:auto;">
              <table class="items-table">
                <thead>
                  <tr>
                    <th>Numero factura</th>
                    <th>CUFE / CUDE</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><input [(ngModel)]="ingresoExtra.numero_factura"></td>
                    <td><input [(ngModel)]="ingresoExtra.cufe"></td>
                    <td><input [(ngModel)]="ingresoExtra.observaciones" placeholder="Notas del ingreso o diferencias contra factura"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="toolbar" style="margin-top:1rem">
            <button class="btn" (click)="crearIngreso()">Crear ingreso</button>
            <button class="btn secondary" (click)="limpiar()">Limpiar</button>
          </div>
        </div>
      }

      <!-- ══ FORMULARIO SIN ORDEN ══════════════════════════════════ -->
      @if (modo() === 'sin_orden') {
        <div class="card">
          <div class="po-section-title">Nuevo ingreso sin orden</div>

          <!-- 1. ENCABEZADO -->
          <div class="po-section">
            <div class="po-section-title">Encabezado</div>
            <div class="form-grid">
              <label>Referencia ingreso<input [(ngModel)]="ingreso.referencia" placeholder="ING-SEBAS-001"></label>
              <label>Fecha recepcion<input type="date" [(ngModel)]="factura.fecha_recepcion"></label>
              <label>Estado
                <select [(ngModel)]="ingreso.estado">
                  <option value="pendiente">Pendiente</option>
                  <option value="recibido">Recibido</option>
                  <option value="almacenado">Almacenado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </label>
            </div>
          </div>

          <!-- 2. DATOS DEL PROVEEDOR -->
          <div class="po-section">
            <div class="po-section-title">Datos del proveedor</div>
            <div class="form-grid">
              <label>Proveedor<input [(ngModel)]="factura.proveedor_nombre"></label>
              <label>NIT proveedor<input [(ngModel)]="factura.proveedor_nit"></label>
              <label>Telefono proveedor<input [(ngModel)]="factura.proveedor_telefono"></label>
              <label class="full">Direccion proveedor<input [(ngModel)]="factura.proveedor_direccion"></label>
            </div>
          </div>

          <!-- 3. DETALLE -->
          <div class="po-section">
            <div class="po-section-title">Detalle</div>
            <div class="form-grid">
              <label>Codigo producto<input [(ngModel)]="factura.codigo_producto"></label>
              <label class="full">Producto / descripcion<input [(ngModel)]="ingreso.producto" placeholder="Descripcion del producto"></label>
              <label>Laboratorio<input [(ngModel)]="factura.laboratorio"></label>
              <label>Presentacion<input [(ngModel)]="factura.presentacion"></label>
              <label>Invima / registro sanitario<input [(ngModel)]="factura.registro_sanitario"></label>
              <label>Lote<input [(ngModel)]="ingreso.lote"></label>
              <label>Fecha vencimiento<input type="date" [(ngModel)]="ingreso.fecha_vencimiento"></label>
              <label>Cantidad<input type="number" [(ngModel)]="ingreso.cantidad"></label>
              <label>Unidad medida<input [(ngModel)]="factura.unidad_medida"></label>
              <label>Valor unitario<input type="number" [(ngModel)]="factura.valor_unitario"></label>
              <label>Descuento<input type="number" [(ngModel)]="factura.descuento"></label>
              <label>IVA / impuesto<input type="number" [(ngModel)]="factura.impuesto"></label>
              <label>Subtotal<input type="number" [(ngModel)]="factura.subtotal"></label>
              <label>Total factura<input type="number" [(ngModel)]="factura.total"></label>
            </div>
          </div>

          <!-- 4. DATOS DE FACTURA -->
          <div class="po-section">
            <div class="po-section-title">Datos de la factura</div>
            <div class="form-grid">
              <label>Numero factura<input [(ngModel)]="factura.numero_factura"></label>
              <label>CUFE / CUDE<input [(ngModel)]="factura.cufe"></label>
              <label>Fecha emision<input type="date" [(ngModel)]="factura.fecha_emision"></label>
              <label>Remision<input [(ngModel)]="factura.remision"></label>
              <label>Forma de pago<input [(ngModel)]="factura.forma_pago"></label>
              <label>Medio de pago<input [(ngModel)]="factura.medio_pago"></label>
              <label class="full">Observaciones<textarea [(ngModel)]="factura.observaciones" placeholder="Notas del ingreso, novedades o diferencias contra factura"></textarea></label>
            </div>
          </div>

          <div class="toolbar" style="margin-top:1rem">
            <button class="btn" (click)="crearIngreso()">Crear ingreso Sebas</button>
            <button class="btn secondary" (click)="limpiar()">Limpiar</button>
          </div>
        </div>
      }
    </section>
  `
})
export class SebasIngresosComponent implements OnInit {
  readonly message = signal('');
  readonly error = signal('');
  readonly filterType = signal<'numero' | 'fecha' | 'laboratorio'>('numero');
  readonly modo = signal<'con_orden' | 'sin_orden' | null>(null);
  readonly cargandoOrdenes = signal(false);
  readonly todasLasOrdenes = signal<any[]>([]);
  readonly ordenesFiltradas = signal<any[]>([]);
  readonly ordenSeleccionada = signal<any>(null);

  filter = { numero_oc: '', fecha_desde: '', fecha_hasta: '', laboratorio: '' };
  ocSearch = '';

  ocMeta: any = this.emptyOcMeta();
  ocItems: any[] = [this.emptyOcItem()];
  ingresoExtra: any = this.emptyIngresoExtra();

  ingreso: any = this.emptyIngreso();
  factura: any = this.emptyFactura();

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    this.cargarOrdenes();
  }

  async cargarOrdenes() {
    this.cargandoOrdenes.set(true);
    try {
      const resp: any = await this.api.get<any>('/purchases');
      const lista = Array.isArray(resp) ? resp : (resp?.data ?? []);
      this.todasLasOrdenes.set(lista);
    } catch (err: any) {
      this.error.set(err?.error?.message || 'No se pudieron cargar las órdenes de compra.');
    } finally {
      this.cargandoOrdenes.set(false);
    }
  }

  filtrarOrdenes() {
    const term = this.ocSearch.toLowerCase().trim();
    if (!term) { this.ordenesFiltradas.set([]); return; }
    this.ordenesFiltradas.set(
      this.todasLasOrdenes().filter(o =>
        String(o.numero_oc ?? '').toLowerCase().includes(term) ||
        String(o.proveedor ?? '').toLowerCase().includes(term)
      ).slice(0, 10)
    );
  }

  seleccionarOrden(oc: any) {
    this.ordenSeleccionada.set(oc);
    this.ocSearch = '';
    this.ordenesFiltradas.set([]);
    this.precargarDesdeOrden(oc);
  }

  deseleccionarOrden() {
    this.ordenSeleccionada.set(null);
    this.ocSearch = '';
    this.ordenesFiltradas.set([]);
    this.limpiar();
  }

  activarConOrden() {
    this.modo.set('con_orden');
    this.ordenSeleccionada.set(null);
    this.ocSearch = '';
    this.ordenesFiltradas.set([]);
    this.limpiar();
    this.cargarOrdenes();
  }

  activarSinOrden() {
    this.modo.set('sin_orden');
    this.ordenSeleccionada.set(null);
    this.limpiar();
  }

  private precargarDesdeOrden(oc: any) {
    this.limpiar();
    const obs = String(oc.observaciones ?? '');
    const meta = this.parseObservaciones(obs);

    this.ocMeta = {
      consecutivo: oc.numero_oc ?? '',
      fecha: oc.fecha ? String(oc.fecha).slice(0, 10) : '',
      sede: meta['sede'] || '',
      bodega: meta['bodega'] || '',
      direccion_sede: meta['direccion_sede'] || '',
      ciudad_sede: meta['ciudad'] || '',
      proveedor_nombre: meta['proveedor'] || oc.proveedor || '',
      proveedor_nit: meta['nit'] || '',
      proveedor_contacto: meta['contacto'] || '',
      proveedor_telefono: meta['telefono'] || '',
      proveedor_direccion: meta['direccion_proveedor'] || '',
    };

    const parsedItems: any[] = [];
    let i = 1;
    while (true) {
      const item = this.parseItem(obs, i);
      if (!item) break;
      parsedItems.push({
        codigo: item['codigo'] ?? '',
        nombre: item['nombre'] ?? '',
        laboratorio: item['laboratorio'] ?? '',
        cantidad: Number(item['cantidad']) || 0,
        valor_unitario: Number(item['valor_unitario']) || 0,
        lote: '',
        fecha_vencimiento: '',
      });
      i++;
    }
    this.ocItems = parsedItems.length > 0 ? parsedItems : [this.emptyOcItem()];
  }

  private parseObservaciones(obs: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const line of obs.split('\n')) {
      const idx = line.indexOf(':');
      if (idx < 1) continue;
      const key = line.slice(0, idx).trim().toLowerCase()
        .replace(/\s+/g, '_').replace(/\//g, '_');
      const value = line.slice(idx + 1).trim();
      if (value) result[key] = value;
    }
    return result;
  }

  private parseItem(obs: string, num: number): Record<string, string> | null {
    const prefix = `Item ${num}:`;
    const line = obs.split('\n').find(l => l.startsWith(prefix));
    if (!line) return null;
    const result: Record<string, string> = {};
    const parts = line.slice(prefix.length).split('|');
    for (const part of parts) {
      const eq = part.indexOf('=');
      if (eq < 1) continue;
      const key = part.slice(0, eq).trim().toLowerCase();
      const val = part.slice(eq + 1).trim();
      result[key] = val;
    }
    return result;
  }

  itemTotal(item: any): number {
    return (Number(item.cantidad) || 0) * (Number(item.valor_unitario) || 0);
  }

  grandTotalOc(): number {
    return this.ocItems.reduce((sum, item) => sum + this.itemTotal(item), 0);
  }

  setFilterType(type: 'numero' | 'fecha' | 'laboratorio') {
    this.filterType.set(type);
    this.filter = { numero_oc: '', fecha_desde: '', fecha_hasta: '', laboratorio: '' };
  }

  clearFilter() {
    this.filter = { numero_oc: '', fecha_desde: '', fecha_hasta: '', laboratorio: '' };
  }

  async crearIngreso() {
    try {
      this.error.set('');
      this.message.set('');
      if (this.modo() === 'con_orden') {
        if (!this.ocItems.some(i => Number(i.cantidad) > 0)) {
          this.error.set('Agrega al menos un item con cantidad.');
          return;
        }
        await this.api.post('/ingresos', this.ingresoConOrdenPayload());
      } else {
        if (!this.ingreso.referencia || !this.ingreso.producto || !Number(this.ingreso.cantidad)) {
          this.error.set('Completa referencia, producto y cantidad.');
          return;
        }
        await this.api.post('/ingresos', this.ingresoSinOrdenPayload());
      }
      this.message.set('Ingreso Sebas creado exitosamente.');
      this.limpiar();
      this.ordenSeleccionada.set(null);
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible crear el ingreso Sebas.');
    }
  }

  limpiar() {
    this.ingreso = this.emptyIngreso();
    this.factura = this.emptyFactura();
    this.ocMeta = this.emptyOcMeta();
    this.ocItems = [this.emptyOcItem()];
    this.ingresoExtra = this.emptyIngresoExtra();
  }

  private ingresoConOrdenPayload() {
    const items = this.ocItems.filter(i => Number(i.cantidad) > 0);
    const itemLines = items.map((i, idx) =>
      `Item ${idx + 1}: codigo=${i.codigo} | nombre=${i.nombre} | laboratorio=${i.laboratorio} | cantidad=${i.cantidad} | valor_unitario=${i.valor_unitario} | lote=${i.lote} | vencimiento=${i.fecha_vencimiento}`
    ).join('\n');
    const metaLines = [
      `Orden: ${this.ocMeta.consecutivo}`,
      `Sede: ${this.ocMeta.sede}`,
      `Bodega: ${this.ocMeta.bodega}`,
      `Proveedor: ${this.ocMeta.proveedor_nombre}`,
      `NIT: ${this.ocMeta.proveedor_nit}`,
      `Factura: ${this.ingresoExtra.numero_factura}`,
      `CUFE: ${this.ingresoExtra.cufe}`,
      `Invima: ${this.ingresoExtra.registro_invima}`,
      `CUM: ${this.ingresoExtra.cum}`,
      `Consecutivo CUM: ${this.ingresoExtra.consecutivo_cum}`,
      `Presentacion: ${this.ingresoExtra.presentacion}`,
      `IVA: ${this.ingresoExtra.iva}`,
      `Temperatura: ${this.ingresoExtra.temperatura}`,
      `Criterio de empleo: ${this.ingresoExtra.criterio_empleo}`,
    ].filter(l => !l.endsWith(': ') && !l.endsWith(': 0')).join('\n');
    return {
      referencia: [this.ocMeta.consecutivo, this.ingresoExtra.numero_factura ? `Factura ${this.ingresoExtra.numero_factura}` : ''].filter(Boolean).join(' - '),
      producto: [items[0]?.nombre ?? 'Ingreso', metaLines, itemLines].filter(Boolean).join('\n'),
      cantidad: items.reduce((sum, i) => sum + Number(i.cantidad), 0),
      lote: items[0]?.lote || null,
      fecha_vencimiento: items[0]?.fecha_vencimiento || null,
      estado: 'recibido'
    };
  }

  private ingresoSinOrdenPayload() {
    const facturaNotes = Object.entries(this.factura)
      .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
      .map(([key, value]) => `${key}: ${value}`)
      .join(' | ');
    return {
      referencia: [this.ingreso.referencia, this.factura.numero_factura ? `Factura ${this.factura.numero_factura}` : ''].filter(Boolean).join(' - '),
      producto: [this.ingreso.producto, facturaNotes ? `Datos factura: ${facturaNotes}` : ''].filter(Boolean).join('\n'),
      cantidad: Number(this.ingreso.cantidad),
      lote: this.ingreso.lote || null,
      fecha_vencimiento: this.ingreso.fecha_vencimiento || null,
      estado: this.ingreso.estado
    };
  }

  private emptyOcMeta() {
    return {
      consecutivo: '',
      fecha: '',
      sede: '',
      bodega: '',
      direccion_sede: '',
      ciudad_sede: '',
      proveedor_nombre: '',
      proveedor_nit: '',
      proveedor_contacto: '',
      proveedor_telefono: '',
      proveedor_direccion: '',
    };
  }

  private emptyOcItem() {
    return { codigo: '', nombre: '', laboratorio: '', cantidad: 0, valor_unitario: 0, lote: '', fecha_vencimiento: '' };
  }

  private emptyIngresoExtra() {
    return {
      numero_factura: '',
      cufe: '',
      fecha_recepcion: new Date().toISOString().slice(0, 10),
      observaciones: '',
      registro_invima: '',
      cum: '',
      consecutivo_cum: '',
      presentacion: '',
      iva: 0,
      temperatura: '',
      criterio_empleo: '',
    };
  }

  private emptyIngreso() {
    return {
      referencia: `ING-SEBAS-${Date.now()}`,
      producto: '',
      cantidad: 1,
      lote: '',
      fecha_vencimiento: '',
      estado: 'pendiente'
    };
  }

  private emptyFactura() {
    return {
      numero_factura: '',
      cufe: '',
      fecha_emision: new Date().toISOString().slice(0, 10),
      fecha_recepcion: new Date().toISOString().slice(0, 10),
      remision: '',
      proveedor_nombre: '',
      proveedor_nit: '',
      proveedor_telefono: '',
      proveedor_direccion: '',
      codigo_producto: '',
      laboratorio: '',
      presentacion: '',
      registro_sanitario: '',
      unidad_medida: 'UN',
      valor_unitario: 0,
      descuento: 0,
      impuesto: 0,
      subtotal: 0,
      total: 0,
      forma_pago: '',
      medio_pago: '',
      observaciones: ''
    };
  }
}
