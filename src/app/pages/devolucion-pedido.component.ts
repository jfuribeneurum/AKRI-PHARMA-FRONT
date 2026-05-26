import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'akri-devolucion-pedido',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
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
    /* lista de ingresos */
    .ing-list { display: flex; flex-direction: column; gap: 0.4rem; max-height: 320px; overflow-y: auto; margin-top: 0.75rem; }
    .ing-item {
      display: flex; align-items: center; justify-content: space-between; gap: 1rem;
      padding: 0.6rem 0.9rem; border: 1.5px solid var(--color-border, #e5e7eb);
      border-radius: 8px; cursor: pointer; background: var(--color-surface, #fff);
      transition: border-color 0.15s, background 0.15s;
    }
    .ing-item:hover { border-color: var(--color-primary, #2563eb); background: #eff6ff; }
    .ing-item-main { display: flex; flex-direction: column; gap: 0.15rem; }
    .ing-ref { font-weight: 700; font-size: 0.9rem; }
    .ing-meta { font-size: 0.78rem; color: #6b7280; }
    .ing-badge { font-size: 0.72rem; font-weight: 600; padding: 0.15rem 0.5rem; border-radius: 99px; white-space: nowrap; }
    .badge-recibido { background: #d1fae5; color: #065f46; }
    .badge-pendiente { background: #fef3c7; color: #92400e; }
    .badge-almacenado { background: #dbeafe; color: #1e40af; }
    .badge-cancelado { background: #fee2e2; color: #991b1b; }
    /* seleccionado */
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
    .items-table tr:last-child td { border-bottom: none; }
    .items-table input { width: 100%; min-width: 0; padding: 0.3rem 0.45rem; border: 1px solid var(--color-border, #d1d5db); border-radius: 4px; font-size: 0.85rem; background: var(--color-surface, #fff); color: inherit; }
    .items-table input:focus { outline: 2px solid var(--color-primary, #2563eb); outline-offset: -1px; }
    .items-table input[readonly] { background: var(--color-surface-2, #f3f4f6); color: #6b7280; border-color: transparent; }
    .dev-input { border: 2px solid #f97316 !important; background: #fff7ed !important; color: #c2410c !important; font-weight: 600; }
    .dev-input:focus { outline: 2px solid #f97316 !important; }
    /* empty */
    .empty-msg { text-align: center; color: #9ca3af; padding: 2rem; font-size: 0.9rem; }
  `],
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Devolución de pedido</h1>
          <p class="page-subtitle">Busca un ingreso Sebas, selecciónalo y registra las cantidades o productos a devolver.</p>
        </div>
        <div class="toolbar" style="margin-bottom:0">
          <button class="btn secondary" (click)="cargarIngresos()">Actualizar</button>
        </div>
      </div>

      @if (message()) { <div class="success-box">{{ message() }}</div> }
      @if (error()) { <div class="error-box">{{ error() }}</div> }

      <!-- ══ BUSCADOR DE INGRESOS ══════════════════════════════════ -->
      <div class="card">
        <div class="po-section-title">Buscar ingreso Sebas</div>

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
            <label>Numero / Referencia<input [(ngModel)]="filter.numero_oc" placeholder="ING-SEBAS-..." (ngModelChange)="applyFilter()"></label>
          }
          @if (filterType() === 'fecha') {
            <label>Desde<input type="date" [(ngModel)]="filter.fecha_desde" (ngModelChange)="applyFilter()"></label>
            <label>Hasta<input type="date" [(ngModel)]="filter.fecha_hasta" (ngModelChange)="applyFilter()"></label>
          }
          @if (filterType() === 'laboratorio') {
            <label>Laboratorio<input [(ngModel)]="filter.laboratorio" placeholder="Nombre del laboratorio" (ngModelChange)="applyFilter()"></label>
          }
          <button class="btn secondary" style="align-self:flex-end;padding:0.45rem 1rem;font-size:0.85rem" (click)="clearFilter()">Limpiar</button>
        </div>

        @if (ingresoSeleccionado()) {
          <div class="selected-banner" style="margin-top:1rem">
            <span>
              Ingreso seleccionado: <strong>{{ ingresoSeleccionado()!.referencia }}</strong>
              &nbsp;&mdash;&nbsp;{{ ingresoSeleccionado()!.fecha_ingreso | date:'dd/MM/yyyy' }}
              &nbsp;&mdash;&nbsp;Cant. original: {{ ingresoSeleccionado()!.cantidad }}
            </span>
            <button class="btn-deselect" (click)="deseleccionarIngreso()" title="Cambiar selección">&times; Cambiar</button>
          </div>
        } @else {
          @if (loading()) {
            <p class="empty-msg">Cargando ingresos...</p>
          } @else if (filteredIngresos().length === 0) {
            <p class="empty-msg">No se encontraron ingresos con los criterios actuales.</p>
          } @else {
            <div class="ing-list">
              @for (ing of filteredIngresos(); track ing.id_ingreso) {
                <div class="ing-item" (click)="seleccionarIngreso(ing)">
                  <div class="ing-item-main">
                    <span class="ing-ref">{{ ing.referencia }}</span>
                    <span class="ing-meta">
                      {{ ing.fecha_ingreso | date:'dd/MM/yyyy' }}
                      &nbsp;|&nbsp; Cant: {{ ing.cantidad }}
                      @if (ing.lote) { &nbsp;|&nbsp; Lote: {{ ing.lote }} }
                    </span>
                  </div>
                  <span class="ing-badge"
                    [class.badge-recibido]="ing.estado==='recibido'"
                    [class.badge-pendiente]="ing.estado==='pendiente'"
                    [class.badge-almacenado]="ing.estado==='almacenado'"
                    [class.badge-cancelado]="ing.estado==='cancelado'">
                    {{ ing.estado }}
                  </span>
                </div>
              }
            </div>
            <div style="font-size:0.8rem;color:#9ca3af;margin-top:0.5rem">
              {{ filteredIngresos().length }} de {{ allIngresos().length }} ingresos
            </div>
          }
        }
      </div>

      <!-- ══ FORMULARIO DE DEVOLUCIÓN ══════════════════════════════ -->
      @if (ingresoSeleccionado()) {
        <div class="card">

          <!-- 1. ENCABEZADO -->
          <div class="po-section">
            <div class="po-section-title">Encabezado</div>
            <div class="form-grid">
              <label>
                Consecutivo devolución
                <input [(ngModel)]="devMeta.referencia" readonly style="background:var(--color-surface-2,#f3f4f6);color:#6b7280">
              </label>
              <label>
                Fecha devolución
                <input type="date" [(ngModel)]="devMeta.fecha">
              </label>
              <label>
                Motivo
                <select [(ngModel)]="devMeta.motivo">
                  <option value="">-- Seleccionar motivo --</option>
                  <option value="Producto vencido">Producto vencido</option>
                  <option value="Producto dañado / deteriorado">Producto dañado / deteriorado</option>
                  <option value="Error en pedido">Error en pedido</option>
                  <option value="Exceso de inventario">Exceso de inventario</option>
                  <option value="Producto no requerido">Producto no requerido</option>
                  <option value="Otro">Otro</option>
                </select>
              </label>
            </div>
          </div>

          <!-- 2. DATOS DEL INGRESO ORIGINAL (solo lectura) -->
          <div class="po-section">
            <div class="po-section-title">Datos del ingreso original</div>
            <div style="overflow-x:auto;">
              <table class="items-table">
                <thead>
                  <tr>
                    <th>Ingreso referencia</th>
                    <th>Proveedor</th>
                    <th>Sede</th>
                    <th>Orden de compra</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><input readonly [value]="ingresoSeleccionado()!.referencia"></td>
                    <td><input readonly [value]="devMeta.proveedor"></td>
                    <td><input readonly [value]="devMeta.sede"></td>
                    <td><input readonly [value]="devMeta.orden_original"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 3. DETALLE A DEVOLVER -->
          <div class="po-section">
            <div class="po-section-title">Detalle — cantidades a devolver</div>
            <div style="overflow-x:auto;">
              <table class="items-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Codigo</th>
                    <th>Nombre</th>
                    <th>Laboratorio</th>
                    <th>Lote</th>
                    <th>Vencimiento</th>
                    <th style="text-align:right">Cant. original</th>
                    <th style="text-align:right;color:#c2410c">Cant. a devolver</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of devItems; track $index) {
                    <tr>
                      <td style="color:#9ca3af;font-size:0.8rem">{{ $index + 1 }}</td>
                      <td><input readonly [value]="item.codigo"></td>
                      <td><input readonly [value]="item.nombre"></td>
                      <td><input readonly [value]="item.laboratorio"></td>
                      <td><input readonly [value]="item.lote"></td>
                      <td><input readonly [value]="item.fecha_vencimiento"></td>
                      <td style="text-align:right">
                        <input readonly [value]="item.cantidad_original" style="text-align:right;width:80px">
                      </td>
                      <td>
                        <input
                          type="number" min="0" [attr.max]="item.cantidad_original"
                          [(ngModel)]="item.cantidad_devolver"
                          class="dev-input"
                          style="text-align:right;width:90px"
                          (change)="clampDevolver(item)"
                        >
                      </td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr style="font-weight:700;background:var(--color-surface-2,#f9fafb)">
                    <td colspan="6" style="padding:0.5rem 0.6rem;text-align:right">Total a devolver</td>
                    <td style="padding:0.5rem 0.6rem;text-align:right">{{ totalOriginal() }}</td>
                    <td style="padding:0.5rem 0.6rem;text-align:right;color:#c2410c">{{ totalDevolver() }}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <!-- 4. OBSERVACIONES -->
          <div class="po-section">
            <div class="po-section-title">Observaciones</div>
            <div style="overflow-x:auto;">
              <table class="items-table">
                <thead>
                  <tr><th>Observaciones de la devolución</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <textarea [(ngModel)]="devMeta.observaciones"
                        placeholder="Describe el estado del producto, novedades o instrucciones de reenvío"
                        style="width:100%;min-height:64px;padding:0.3rem 0.45rem;border:1px solid var(--color-border,#d1d5db);border-radius:4px;font-size:0.85rem;resize:vertical">
                      </textarea>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="toolbar" style="margin-top:1rem">
            <button class="btn" style="background:#ef4444;border-color:#ef4444" (click)="crearDevolucion()" [disabled]="saving()">
              {{ saving() ? 'Registrando...' : 'Registrar devolución' }}
            </button>
            <button class="btn secondary" (click)="deseleccionarIngreso()">Cancelar</button>
          </div>

        </div>
      }
    </section>
  `
})
export class DevolucionPedidoComponent implements OnInit {
  readonly filterType = signal<'numero' | 'fecha' | 'laboratorio'>('numero');
  readonly allIngresos = signal<any[]>([]);
  readonly filteredIngresos = signal<any[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly ingresoSeleccionado = signal<any>(null);

  filter = { numero_oc: '', fecha_desde: '', fecha_hasta: '', laboratorio: '' };

  devMeta: any = this.emptyDevMeta();
  devItems: any[] = [];

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    void this.cargarIngresos();
  }

  async cargarIngresos() {
    this.loading.set(true);
    this.error.set('');
    try {
      const resp: any = await this.api.get<any>('/ingresos');
      const lista = Array.isArray(resp) ? resp : (resp?.data ?? []);
      this.allIngresos.set(lista);
      this.applyFilter();
    } catch (err: any) {
      this.error.set(err?.error?.message || 'No se pudieron cargar los ingresos.');
    } finally {
      this.loading.set(false);
    }
  }

  applyFilter() {
    const num = this.filter.numero_oc.toLowerCase().trim();
    const desde = this.filter.fecha_desde.trim();
    const hasta = this.filter.fecha_hasta.trim();
    const lab = this.filter.laboratorio.toLowerCase().trim();

    this.filteredIngresos.set(
      this.allIngresos().filter(row => {
        if (num && !String(row.referencia ?? '').toLowerCase().includes(num)) return false;
        const fecha = String(row.fecha_ingreso ?? '').slice(0, 10);
        if (desde && fecha < desde) return false;
        if (hasta && fecha > hasta) return false;
        if (lab && !String(row.producto ?? '').toLowerCase().includes(lab)) return false;
        return true;
      })
    );
  }

  setFilterType(type: 'numero' | 'fecha' | 'laboratorio') {
    this.filterType.set(type);
    this.filter = { numero_oc: '', fecha_desde: '', fecha_hasta: '', laboratorio: '' };
    this.applyFilter();
  }

  clearFilter() {
    this.filter = { numero_oc: '', fecha_desde: '', fecha_hasta: '', laboratorio: '' };
    this.applyFilter();
  }

  seleccionarIngreso(ing: any) {
    this.ingresoSeleccionado.set(ing);
    this.precargarDevolucion(ing);
  }

  deseleccionarIngreso() {
    this.ingresoSeleccionado.set(null);
    this.devMeta = this.emptyDevMeta();
    this.devItems = [];
  }

  clampDevolver(item: any) {
    const val = Number(item.cantidad_devolver) || 0;
    item.cantidad_devolver = Math.min(Math.max(val, 0), Number(item.cantidad_original) || 0);
  }

  totalOriginal(): number {
    return this.devItems.reduce((s, i) => s + (Number(i.cantidad_original) || 0), 0);
  }

  totalDevolver(): number {
    return this.devItems.reduce((s, i) => s + (Number(i.cantidad_devolver) || 0), 0);
  }

  async crearDevolucion() {
    this.error.set('');
    this.message.set('');

    if (!this.devMeta.motivo) {
      this.error.set('El motivo de devolución es obligatorio.');
      return;
    }
    const itemsADevolver = this.devItems.filter(i => Number(i.cantidad_devolver) > 0);
    if (!itemsADevolver.length) {
      this.error.set('Ingresa al menos una cantidad a devolver.');
      return;
    }

    this.saving.set(true);
    try {
      const itemLines = itemsADevolver.map((i, idx) =>
        `Item ${idx + 1}: codigo=${i.codigo} | nombre=${i.nombre} | laboratorio=${i.laboratorio} | lote=${i.lote} | vencimiento=${i.fecha_vencimiento} | cantidad_devuelta=${i.cantidad_devolver} | cantidad_original=${i.cantidad_original}`
      ).join('\n');

      const metaLines = [
        `Ingreso original: ${this.ingresoSeleccionado()?.referencia}`,
        `Proveedor: ${this.devMeta.proveedor}`,
        `Sede: ${this.devMeta.sede}`,
        `Orden: ${this.devMeta.orden_original}`,
        `Motivo: ${this.devMeta.motivo}`,
        `Observaciones: ${this.devMeta.observaciones}`,
      ].filter(l => !l.endsWith(': ')).join('\n');

      await this.api.post('/ingresos', {
        referencia: this.devMeta.referencia,
        producto: [metaLines, itemLines].filter(Boolean).join('\n'),
        cantidad: itemsADevolver.reduce((s, i) => s + Number(i.cantidad_devolver), 0),
        lote: itemsADevolver[0]?.lote || null,
        fecha_vencimiento: itemsADevolver[0]?.fecha_vencimiento || null,
        estado: 'cancelado',
      });

      this.message.set('Devolución registrada exitosamente.');
      this.deseleccionarIngreso();
      await this.cargarIngresos();
    } catch (err: any) {
      this.error.set(err?.error?.message || 'No fue posible registrar la devolución.');
    } finally {
      this.saving.set(false);
    }
  }

  private precargarDevolucion(ing: any) {
    const producto = String(ing.producto ?? '');
    const meta = this.parseMeta(producto);

    this.devMeta = {
      referencia: `DEV-${ing.referencia}`,
      fecha: new Date().toISOString().slice(0, 10),
      motivo: '',
      observaciones: '',
      proveedor: meta['proveedor'] || '',
      sede: meta['sede'] || '',
      orden_original: meta['orden'] || meta['orden_de_compra'] || '',
    };

    const items = this.parseAllItems(producto);
    this.devItems = items.length > 0
      ? items.map(item => ({
          codigo: item['codigo'] ?? '',
          nombre: item['nombre'] ?? '',
          laboratorio: item['laboratorio'] ?? '',
          lote: item['lote'] ?? ing.lote ?? '',
          fecha_vencimiento: item['vencimiento'] ?? ing.fecha_vencimiento ?? '',
          valor_unitario: Number(item['valor_unitario']) || 0,
          cantidad_original: Number(item['cantidad']) || Number(ing.cantidad) || 0,
          cantidad_devolver: 0,
        }))
      : [{
          codigo: '',
          nombre: producto.split('\n')[0]?.trim() ?? '',
          laboratorio: '',
          lote: ing.lote ?? '',
          fecha_vencimiento: ing.fecha_vencimiento ?? '',
          valor_unitario: 0,
          cantidad_original: Number(ing.cantidad) || 0,
          cantidad_devolver: 0,
        }];
  }

  private parseMeta(texto: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const line of texto.split('\n')) {
      if (line.startsWith('Item ')) continue;
      const idx = line.indexOf(':');
      if (idx < 1) continue;
      const key = line.slice(0, idx).trim().toLowerCase().replace(/\s+/g, '_').replace(/\//g, '_');
      const value = line.slice(idx + 1).trim();
      if (value) result[key] = value;
    }
    return result;
  }

  private parseAllItems(texto: string): Record<string, string>[] {
    const items: Record<string, string>[] = [];
    let i = 1;
    while (true) {
      const prefix = `Item ${i}:`;
      const line = texto.split('\n').find(l => l.startsWith(prefix));
      if (!line) break;
      const item: Record<string, string> = {};
      for (const part of line.slice(prefix.length).split('|')) {
        const eq = part.indexOf('=');
        if (eq < 1) continue;
        item[part.slice(0, eq).trim().toLowerCase()] = part.slice(eq + 1).trim();
      }
      items.push(item);
      i++;
    }
    return items;
  }

  private emptyDevMeta() {
    return {
      referencia: '',
      fecha: new Date().toISOString().slice(0, 10),
      motivo: '',
      observaciones: '',
      proveedor: '',
      sede: '',
      orden_original: '',
    };
  }
}
