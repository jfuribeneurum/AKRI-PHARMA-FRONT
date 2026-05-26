import { Component, signal } from '@angular/core';
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
    .po-section { margin-bottom: 1.5rem; }
    .po-section-title {
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--color-primary, #2563eb);
      border-bottom: 2px solid var(--color-primary, #2563eb);
      padding-bottom: 0.35rem;
      margin-bottom: 1rem;
    }
    .items-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    .items-table th {
      background: var(--color-surface-2, #f3f4f6);
      padding: 0.5rem 0.6rem;
      text-align: left;
      font-weight: 600;
      font-size: 0.78rem;
      white-space: nowrap;
    }
    .items-table td { padding: 0.35rem 0.4rem; border-bottom: 1px solid var(--color-border, #e5e7eb); vertical-align: middle; }
    .items-table input { width: 100%; min-width: 0; padding: 0.3rem 0.45rem; border: 1px solid var(--color-border, #d1d5db); border-radius: 4px; font-size: 0.85rem; background: var(--color-surface, #fff); color: inherit; }
    .items-table input:focus { outline: 2px solid var(--color-primary, #2563eb); outline-offset: -1px; }
    .total-row td { font-weight: 700; background: var(--color-surface-2, #f9fafb); padding: 0.5rem 0.6rem; }
    .valor-total-cell { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .btn-remove { background: none; border: none; color: #ef4444; cursor: pointer; font-size: 1rem; padding: 0 0.3rem; line-height: 1; }
    .btn-remove:hover { color: #b91c1c; }
    .btn-add-row { margin-top: 0.6rem; }
    .grand-total { display: flex; justify-content: flex-end; align-items: center; gap: 1rem; padding: 0.75rem 0 0; font-size: 1rem; font-weight: 700; }
    .grand-total span { font-size: 1.15rem; color: var(--color-primary, #2563eb); }
  `],
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Orden de Compra</h1>
        </div>
      </div>

      @if (message()) { <div class="success-box">{{ message() }}</div> }
      @if (error()) { <div class="error-box">{{ error() }}</div> }

      <div class="card">

        <!-- ── 1. ENCABEZADO ───────────────────────────────────────── -->
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

        <!-- ── 2. DATOS DE LA SEDE ─────────────────────────────────── -->
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

        <!-- ── 3. DATOS DEL PROVEEDOR ──────────────────────────────── -->
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

        <!-- ── 4. DETALLE ──────────────────────────────────────────── -->
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
          <button class="btn btn-outline btn-add-row" (click)="addItem()">+ Agregar item</button>
        </div>

        <!-- ── OBSERVACIONES ───────────────────────────────────────── -->
        <div class="po-section">
          <div class="form-grid">
            <label class="full">
              Observaciones
              <textarea [(ngModel)]="order.observaciones" placeholder="Condiciones, notas o instrucciones especiales"></textarea>
            </label>
          </div>
        </div>

        <div style="display:flex; gap:0.75rem; flex-wrap:wrap; align-items:center">
          <button class="btn" (click)="createPurchase()" [disabled]="saving()">
            {{ saving() ? 'Guardando...' : 'Crear orden de compra' }}
          </button>
        </div>
      </div>
    </section>
  `
})
export class SebasPurchaseOrderComponent {
  readonly message = signal('');
  readonly error = signal('');
  readonly saving = signal(false);

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
    } catch (err: any) {
      this.error.set(err?.error?.message || 'No fue posible crear la orden de compra.');
    } finally {
      this.saving.set(false);
    }
  }

  private buildPayload() {
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

    const notes = [this.order.observaciones?.trim(), meta].filter(Boolean).join('\n\n');

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
