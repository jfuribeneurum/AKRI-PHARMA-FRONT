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
    .section-title {
      font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
      color: var(--color-primary, #2563eb); border-bottom: 2px solid var(--color-primary, #2563eb);
      padding-bottom: 0.35rem; margin-bottom: 1rem;
    }
  `],
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Ingresos Sebas</h1>
          <p class="page-subtitle">Registro separado de ingreso con datos de factura, proveedor, producto, lote y valores.</p>
        </div>
      </div>

      <div *ngIf="message()" class="success-box">{{ message() }}</div>
      <div *ngIf="error()" class="error-box">{{ error() }}</div>

      <!-- ══ BUSCADOR DE INGRESOS ══════════════════════════════════ -->
      <div class="card">
        <div class="section-title">Buscar ingresos</div>

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
          <div class="section-title">Seleccionar orden de compra</div>

          <!-- orden ya seleccionada -->
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
            <!-- buscador de OC -->
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
                      <span class="oc-meta">{{ oc.proveedor }} &nbsp;|&nbsp; {{ oc.fecha | date:'dd/MM/yyyy' }} &nbsp;|&nbsp; {{ oc.sede }}</span>
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

      <!-- ══ FORMULARIO INGRESO ════════════════════════════════════ -->
      @if (modo() === 'sin_orden' || (modo() === 'con_orden' && ordenSeleccionada())) {
        <div class="card">
          <div class="section-head">
            <div>
              <h3>Nuevo ingreso Sebas</h3>
              <span class="muted">Los campos extendidos quedan consolidados en la referencia y descripcion del ingreso</span>
            </div>
          </div>

          <div class="form-grid">
            <label>Referencia ingreso<input [(ngModel)]="ingreso.referencia" placeholder="ING-SEBAS-001"></label>
            <label>Estado<select [(ngModel)]="ingreso.estado"><option value="pendiente">Pendiente</option><option value="recibido">Recibido</option><option value="almacenado">Almacenado</option><option value="cancelado">Cancelado</option></select></label>
            <label>Numero factura<input [(ngModel)]="factura.numero_factura"></label>
            <label>CUFE / CUDE<input [(ngModel)]="factura.cufe"></label>
            <label>Fecha emision<input type="date" [(ngModel)]="factura.fecha_emision"></label>
            <label>Fecha recepcion<input type="date" [(ngModel)]="factura.fecha_recepcion"></label>
            <label>Orden de compra<input [(ngModel)]="factura.orden_compra"></label>
            <label>Remision<input [(ngModel)]="factura.remision"></label>
            <label>Proveedor<input [(ngModel)]="factura.proveedor_nombre"></label>
            <label>NIT proveedor<input [(ngModel)]="factura.proveedor_nit"></label>
            <label>Telefono proveedor<input [(ngModel)]="factura.proveedor_telefono"></label>
            <label class="full">Direccion proveedor<input [(ngModel)]="factura.proveedor_direccion"></label>
            <label>Cliente / receptor<input [(ngModel)]="factura.cliente_nombre"></label>
            <label>NIT cliente<input [(ngModel)]="factura.cliente_nit"></label>
            <label class="full">Direccion cliente<input [(ngModel)]="factura.cliente_direccion"></label>
            <label>Codigo producto<input [(ngModel)]="factura.codigo_producto"></label>
            <label class="full">Producto / descripcion<input [(ngModel)]="ingreso.producto" placeholder="Descripcion del producto"></label>
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
            <label>Forma de pago<input [(ngModel)]="factura.forma_pago"></label>
            <label>Medio de pago<input [(ngModel)]="factura.medio_pago"></label>
            <label class="full">Observaciones<textarea [(ngModel)]="factura.observaciones" placeholder="Notas del ingreso, novedades o diferencias contra factura"></textarea></label>
          </div>

          <div class="toolbar" style="margin-top: 1rem;">
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

    this.factura.orden_compra   = oc.numero_oc ?? '';
    this.factura.proveedor_nombre = meta['proveedor'] || oc.proveedor || '';
    this.factura.proveedor_nit    = meta['nit'] || '';
    this.factura.proveedor_telefono = meta['telefono'] || '';
    this.factura.proveedor_direccion = meta['direccion_proveedor'] || '';
    this.factura.forma_pago = meta['forma_de_pago'] || '';

    // datos del primer item si existe
    const item1 = this.parseItem(obs, 1);
    if (item1) {
      this.factura.codigo_producto = item1['codigo'] ?? '';
      this.ingreso.producto        = item1['nombre'] ?? '';
      this.ingreso.cantidad        = Number(item1['cantidad']) || 1;
      this.factura.valor_unitario  = Number(item1['valor_unitario']) || 0;
    }
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
      if (!this.ingreso.referencia || !this.ingreso.producto || !Number(this.ingreso.cantidad)) {
        this.error.set('Completa referencia, producto y cantidad.');
        return;
      }
      await this.api.post('/ingresos', this.ingresoPayload());
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
  }

  private ingresoPayload() {
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
      orden_compra: '',
      remision: '',
      proveedor_nombre: '',
      proveedor_nit: '',
      proveedor_telefono: '',
      proveedor_direccion: '',
      cliente_nombre: '',
      cliente_nit: '',
      cliente_direccion: '',
      codigo_producto: '',
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
