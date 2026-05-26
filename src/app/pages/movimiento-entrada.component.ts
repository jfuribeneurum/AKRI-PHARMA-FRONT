import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'akri-movimiento-entrada',
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
    .items-table select:focus, .items-table input:focus { outline:2px solid var(--color-primary,#2563eb); outline-offset:-1px; }
    .row-selectable:hover { background:#eff6ff; cursor:pointer; }
    .row-selected { background:#dbeafe !important; }
    .selected-banner {
      display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;
      padding:0.65rem 1rem; background:#eff6ff; border:1.5px solid var(--color-primary,#2563eb);
      border-radius:8px; margin-bottom:1rem; font-size:0.88rem;
    }
    .selected-banner strong { color:var(--color-primary,#2563eb); }
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
  `],
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Movimiento de Entrada</h1>
          <p class="page-subtitle">Registra ingresos de stock: compras, devoluciones de venta o liberaciones de cuarentena.</p>
        </div>
        <div class="toolbar" style="margin-bottom:0">
          <button class="btn secondary" (click)="cargarDatos()">Actualizar</button>
        </div>
      </div>

      @if (message()) { <div class="success-box">{{ message() }}</div> }
      @if (error()) { <div class="error-box">{{ error() }}</div> }

      <!-- Buscar lote -->
      <div class="card">
        <div class="po-section-title">Buscar lote existente</div>
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
                <th>Stock actual</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @if (loading()) {
                <tr><td colspan="8" class="empty-msg">Cargando...</td></tr>
              } @else if (filteredStock().length === 0) {
                <tr><td colspan="8" class="empty-msg">No se encontraron lotes.</td></tr>
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
                    <td><strong>{{ item.cantidad_disponible }}</strong></td>
                    <td>
                      <button class="btn" style="padding:0.2rem 0.55rem;font-size:0.78rem"
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

      <!-- Formulario de entrada -->
      @if (loteSeleccionado()) {
        <div class="selected-banner">
          <span>
            <strong>{{ loteSeleccionado().nombre_comercial }}</strong>
            &nbsp;—&nbsp;Lote: {{ loteSeleccionado().numero_lote }}
            &nbsp;|&nbsp;Stock actual: <strong>{{ loteSeleccionado().cantidad_disponible }}</strong>
          </span>
          <button class="btn-deselect" (click)="deseleccionar()">✕</button>
        </div>

        <div class="card">
          <div class="po-section-title">Detalle del movimiento de entrada</div>
          <div style="overflow-x:auto">
            <table class="items-table">
              <thead>
                <tr>
                  <th>Tipo de movimiento</th>
                  <th>Ubicación destino</th>
                  <th>Cantidad a ingresar</th>
                  <th>Costo unitario</th>
                  <th>Motivo / Referencia</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="min-width:180px">
                    <select [(ngModel)]="form.tipo">
                      <option value="entrada_compra">Entrada compra</option>
                      <option value="devolucion_venta">Devolución de venta</option>
                      <option value="liberacion">Liberación de cuarentena</option>
                    </select>
                  </td>
                  <td style="min-width:220px">
                    <select [(ngModel)]="form.id_ubicacion_destino">
                      <option value="0">-- Seleccionar ubicación --</option>
                      @for (u of lookups.ubicaciones; track u.id_ubicacion) {
                        <option [value]="u.id_ubicacion">{{ u.almacen }} › {{ u.nombre }}</option>
                      }
                    </select>
                  </td>
                  <td style="min-width:130px">
                    <input type="number" [(ngModel)]="form.cantidad" min="0.001" step="1">
                  </td>
                  <td style="min-width:130px">
                    <input type="number" [(ngModel)]="form.costo_unitario" min="0" step="0.01" placeholder="0.00">
                  </td>
                  <td style="min-width:220px">
                    <input type="text" [(ngModel)]="form.motivo" placeholder="Ej: Compra factura #123...">
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="toolbar" style="margin-top:1rem">
            <button class="btn" [disabled]="saving()" (click)="registrar()">
              {{ saving() ? 'Registrando...' : 'Registrar entrada' }}
            </button>
            <button class="btn secondary" (click)="deseleccionar()">Cancelar</button>
          </div>
        </div>
      }
    </section>
  `
})
export class MovimientoEntradaComponent implements OnInit {
  private api = inject(ApiService);

  loading = signal(false);
  saving = signal(false);
  message = signal('');
  error = signal('');
  allStock = signal<any[]>([]);
  filteredStock = signal<any[]>([]);
  loteSeleccionado = signal<any>(null);

  lookups: { almacenes: any[]; ubicaciones: any[] } = { almacenes: [], ubicaciones: [] };
  searchText = '';
  form = { tipo: 'entrada_compra', id_ubicacion_destino: 0, cantidad: 1, costo_unitario: 0, motivo: '' };

  async ngOnInit() {
    await Promise.all([this.cargarStock(), this.cargarLookups()]);
  }

  async cargarDatos() {
    await Promise.all([this.cargarStock(), this.cargarLookups()]);
  }

  async cargarStock() {
    this.loading.set(true);
    try {
      const resp: any = await this.api.get('/inventory/stock');
      const lista = Array.isArray(resp) ? resp : (resp?.data ?? []);
      this.allStock.set(lista);
      this.filtrar();
    } catch {
      this.allStock.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async cargarLookups() {
    try {
      const resp: any = await this.api.get('/inventory/lookups');
      const data = resp?.data ?? resp ?? {};
      this.lookups = { almacenes: data.almacenes ?? [], ubicaciones: data.ubicaciones ?? [] };
    } catch {}
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
    this.form.costo_unitario = Number(item.costo_unitario) || 0;
    this.message.set('');
    this.error.set('');
  }

  deseleccionar() {
    this.loteSeleccionado.set(null);
    this.form = { tipo: 'entrada_compra', id_ubicacion_destino: 0, cantidad: 1, costo_unitario: 0, motivo: '' };
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
    if (!Number(this.form.id_ubicacion_destino)) { this.error.set('Selecciona la ubicación destino.'); return; }
    if (!this.form.cantidad || Number(this.form.cantidad) <= 0) { this.error.set('La cantidad debe ser mayor a 0.'); return; }

    this.saving.set(true);
    try {
      const idUbicacion = Number(this.form.id_ubicacion_destino);
      const idAlmacen = this.lookups.ubicaciones.find(u => u.id_ubicacion === idUbicacion)?.id_almacen ?? null;
      await this.api.post('/inventory/movements', {
        tipo: this.form.tipo,
        id_lote: lote.id_lote,
        id_almacen_destino: idAlmacen,
        id_ubicacion_destino: idUbicacion,
        cantidad: Number(this.form.cantidad),
        costo_unitario: this.form.costo_unitario ? Number(this.form.costo_unitario) : null,
        motivo: this.form.motivo || null
      });
      this.message.set('Entrada de inventario registrada exitosamente.');
      await this.cargarStock();
      this.deseleccionar();
    } catch (err: any) {
      this.error.set(err?.error?.message || 'No fue posible registrar el movimiento.');
    } finally {
      this.saving.set(false);
    }
  }
}
