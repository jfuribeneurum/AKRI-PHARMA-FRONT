import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'akri-movimiento-salida',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    .search-row { display:flex; gap:0.75rem; align-items:flex-end; margin-bottom:0.75rem; }
    .search-row input { flex:1; padding:0.45rem 0.65rem; border:1px solid var(--color-border,#d1d5db); border-radius:6px; font-size:0.88rem; background:var(--color-surface,#fff); color:inherit; }
    .search-row input:focus { outline:2px solid var(--color-primary,#2563eb); outline-offset:-1px; }
    .items-table { width:100%; border-collapse:collapse; font-size:0.88rem; }
    .items-table th { background:var(--color-surface-2,#f3f4f6); padding:0.5rem 0.6rem; text-align:left; font-weight:600; font-size:0.78rem; white-space:nowrap; }
    .items-table td { padding:0.35rem 0.5rem; border-bottom:1px solid var(--color-border,#e5e7eb); vertical-align:middle; }
    .items-table tr:last-child td { border-bottom:none; }
    .items-table select, .items-table input[type=number], .items-table input[type=text] {
      width:100%; padding:0.3rem 0.45rem; border:1px solid var(--color-border,#d1d5db);
      border-radius:4px; font-size:0.85rem; background:var(--color-surface,#fff); color:inherit;
    }
    .items-table input[readonly] { background:var(--color-surface-2,#f3f4f6); color:#6b7280; border-color:transparent; }
    .items-table select:focus, .items-table input:focus { outline:2px solid var(--color-primary,#2563eb); outline-offset:-1px; }
    .row-selectable:hover { background:#fff7ed; cursor:pointer; }
    .row-selected { background:#ffedd5 !important; }
    .selected-banner {
      display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;
      padding:0.65rem 1rem; background:#fff7ed; border:1.5px solid #f97316;
      border-radius:8px; margin-bottom:1rem; font-size:0.88rem;
    }
    .selected-banner strong { color:#c2410c; }
    .btn-deselect { background:none; border:none; color:#ef4444; cursor:pointer; font-size:1rem; font-weight:700; padding:0 0.25rem; }
    .po-section-title {
      font-size:0.78rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em;
      color:var(--color-primary,#2563eb); border-bottom:2px solid var(--color-primary,#2563eb);
      padding-bottom:0.35rem; margin-bottom:1rem;
    }
    .empty-msg { text-align:center; color:#9ca3af; padding:2rem; font-size:0.9rem; }
    .badge-vence-ok { color:#065f46; background:#d1fae5; padding:0.1rem 0.45rem; border-radius:99px; font-size:0.72rem; font-weight:600; }
    .badge-vence-warn { color:#92400e; background:#fef3c7; padding:0.1rem 0.45rem; border-radius:99px; font-size:0.72rem; font-weight:600; }
    .badge-vence-bad { color:#991b1b; background:#fee2e2; padding:0.1rem 0.45rem; border-radius:99px; font-size:0.72rem; font-weight:600; }
    .cant-warn { color:#c2410c; font-weight:700; }
  `],
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Movimiento de Salida</h1>
          <p class="page-subtitle">Registra egresos de stock: ventas, mermas, destrucciones o devoluciones a proveedor.</p>
        </div>
        <div class="toolbar" style="margin-bottom:0">
          <button class="btn secondary" (click)="cargarStock()">Actualizar</button>
        </div>
      </div>

      @if (message()) { <div class="success-box">{{ message() }}</div> }
      @if (error()) { <div class="error-box">{{ error() }}</div> }

      <!-- Buscar lote -->
      <div class="card">
        <div class="po-section-title">Buscar lote con stock disponible</div>
        <div class="search-row">
          <input [(ngModel)]="searchText" (ngModelChange)="filtrar()" placeholder="Buscar por producto, SKU o número de lote...">
        </div>
        <div style="overflow-x:auto">
          <table class="items-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>SKU</th>
                <th>Lote</th>
                <th>Vencimiento</th>
                <th>Almacén</th>
                <th>Ubicación</th>
                <th>Disponible</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @if (loading()) {
                <tr><td colspan="8" class="empty-msg">Cargando...</td></tr>
              } @else if (filteredStock().length === 0) {
                <tr><td colspan="8" class="empty-msg">No se encontraron lotes con stock disponible.</td></tr>
              } @else {
                @for (item of filteredStock(); track item.id_lote) {
                  <tr class="row-selectable" [class.row-selected]="loteSeleccionado()?.id_lote === item.id_lote" (click)="seleccionar(item)">
                    <td><strong>{{ item.nombre_comercial }}</strong></td>
                    <td style="color:#6b7280;font-size:0.82rem">{{ item.sku }}</td>
                    <td>{{ item.numero_lote }}</td>
                    <td>
                      <span [class]="vencClass(item.dias_para_vencer)">
                        {{ item.fecha_vencimiento | date:'dd/MM/yyyy' }}
                      </span>
                    </td>
                    <td>{{ item.almacen }}</td>
                    <td>{{ item.ubicacion }}</td>
                    <td>
                      <span [class.cant-warn]="item.cantidad_disponible <= 10">
                        {{ item.cantidad_disponible }}
                      </span>
                    </td>
                    <td>
                      <button class="btn" style="padding:0.2rem 0.55rem;font-size:0.78rem;background:#f97316;border-color:#f97316"
                        (click)="$event.stopPropagation(); seleccionar(item)">
                        Seleccionar
                      </button>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Formulario de salida -->
      @if (loteSeleccionado()) {
        <div class="selected-banner">
          <span>
            <strong>{{ loteSeleccionado().nombre_comercial }}</strong>
            &nbsp;—&nbsp;Lote: {{ loteSeleccionado().numero_lote }}
            &nbsp;|&nbsp;Disponible: <strong>{{ loteSeleccionado().cantidad_disponible }}</strong>
            &nbsp;|&nbsp;{{ loteSeleccionado().almacen }} › {{ loteSeleccionado().ubicacion }}
          </span>
          <button class="btn-deselect" (click)="deseleccionar()">✕</button>
        </div>

        <div class="card">
          <div class="po-section-title">Detalle del movimiento de salida</div>

          <!-- Origen (readonly info) -->
          <div style="overflow-x:auto; margin-bottom:1rem">
            <table class="items-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Lote</th>
                  <th>Vencimiento</th>
                  <th>Almacén origen</th>
                  <th>Ubicación origen</th>
                  <th>Stock disponible</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{{ loteSeleccionado().nombre_comercial }}</td>
                  <td>{{ loteSeleccionado().numero_lote }}</td>
                  <td>{{ loteSeleccionado().fecha_vencimiento | date:'dd/MM/yyyy' }}</td>
                  <td><input [value]="loteSeleccionado().almacen" readonly></td>
                  <td><input [value]="loteSeleccionado().ubicacion" readonly></td>
                  <td><strong>{{ loteSeleccionado().cantidad_disponible }}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Configuración de salida -->
          <div style="overflow-x:auto">
            <table class="items-table">
              <thead>
                <tr>
                  <th>Tipo de movimiento</th>
                  <th>Cantidad a retirar</th>
                  <th>Motivo / Referencia</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="min-width:200px">
                    <select [(ngModel)]="form.tipo">
                      <option value="salida_venta">Salida por venta</option>
                      <option value="merma">Merma</option>
                      <option value="destruccion">Destrucción</option>
                      <option value="cuarentena">Pasar a cuarentena</option>
                      <option value="devolucion_compra">Devolución a proveedor</option>
                    </select>
                  </td>
                  <td style="min-width:150px">
                    <input type="number" [(ngModel)]="form.cantidad" min="0.001" step="1"
                      [max]="loteSeleccionado().cantidad_disponible"
                      (ngModelChange)="clampCantidad()">
                    <span style="font-size:0.72rem;color:#6b7280">Máx: {{ loteSeleccionado().cantidad_disponible }}</span>
                  </td>
                  <td style="min-width:250px">
                    <input type="text" [(ngModel)]="form.motivo" placeholder="Ej: Venta al mostrador, merma por deterioro...">
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="toolbar" style="margin-top:1rem">
            <button class="btn" style="background:#f97316;border-color:#f97316" [disabled]="saving()" (click)="registrar()">
              {{ saving() ? 'Registrando...' : 'Registrar salida' }}
            </button>
            <button class="btn secondary" (click)="deseleccionar()">Cancelar</button>
          </div>
        </div>
      }
    </section>
  `
})
export class MovimientoSalidaComponent implements OnInit {
  private api = inject(ApiService);

  loading = signal(false);
  saving = signal(false);
  message = signal('');
  error = signal('');
  allStock = signal<any[]>([]);
  filteredStock = signal<any[]>([]);
  loteSeleccionado = signal<any>(null);

  searchText = '';
  form = { tipo: 'salida_venta', cantidad: 1, motivo: '' };

  async ngOnInit() {
    await this.cargarStock();
  }

  async cargarStock() {
    this.loading.set(true);
    try {
      const resp: any = await this.api.get('/inventory/stock');
      const lista = Array.isArray(resp) ? resp : (resp?.data ?? []);
      // Solo lotes con stock disponible
      this.allStock.set(lista.filter((i: any) => Number(i.cantidad_disponible) > 0));
      this.filtrar();
    } catch {
      this.allStock.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  filtrar() {
    const q = this.searchText.toLowerCase().trim();
    const lista = this.allStock();
    this.filteredStock.set(!q ? lista : lista.filter(i =>
      (i.nombre_comercial || '').toLowerCase().includes(q) ||
      (i.sku || '').toLowerCase().includes(q) ||
      (i.numero_lote || '').toLowerCase().includes(q)
    ));
  }

  seleccionar(item: any) {
    this.loteSeleccionado.set(item);
    this.form.cantidad = 1;
    this.message.set('');
    this.error.set('');
  }

  deseleccionar() {
    this.loteSeleccionado.set(null);
    this.form = { tipo: 'salida_venta', cantidad: 1, motivo: '' };
  }

  clampCantidad() {
    const lote = this.loteSeleccionado();
    if (!lote) return;
    const max = Number(lote.cantidad_disponible);
    if (Number(this.form.cantidad) > max) this.form.cantidad = max;
    if (Number(this.form.cantidad) < 0) this.form.cantidad = 0;
  }

  vencClass(dias: number) {
    if (dias > 90) return 'badge-vence-ok';
    if (dias > 30) return 'badge-vence-warn';
    return 'badge-vence-bad';
  }

  async registrar() {
    this.error.set('');
    this.message.set('');
    const lote = this.loteSeleccionado();
    if (!lote) { this.error.set('Selecciona un lote.'); return; }
    if (!this.form.cantidad || Number(this.form.cantidad) <= 0) { this.error.set('La cantidad debe ser mayor a 0.'); return; }
    if (Number(this.form.cantidad) > Number(lote.cantidad_disponible)) {
      this.error.set(`La cantidad no puede superar el stock disponible (${lote.cantidad_disponible}).`);
      return;
    }

    this.saving.set(true);
    try {
      await this.api.post('/inventory/movements', {
        tipo: this.form.tipo,
        id_lote: lote.id_lote,
        id_almacen_origen: lote.id_almacen,
        id_ubicacion_origen: lote.id_ubicacion,
        cantidad: Number(this.form.cantidad),
        motivo: this.form.motivo || null
      });
      this.message.set('Salida de inventario registrada exitosamente.');
      await this.cargarStock();
      this.deseleccionar();
    } catch (err: any) {
      this.error.set(err?.error?.message || 'No fue posible registrar el movimiento.');
    } finally {
      this.saving.set(false);
    }
  }
}
