import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

type ExportFormat = 'json' | 'excel' | 'pdf';

@Component({
  selector: 'akri-purchases',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page grid">
      <div class="page-header">
        <div>
          <h1 class="page-title">Compras</h1>
          <p class="page-subtitle">Gestiona órdenes de compra, recepciones por código de barras y exportaciones multi-formato.</p>
        </div>
        <div class="toolbar" style="margin-bottom: 0; justify-content: flex-end;">
          <button class="btn secondary" (click)="exportPurchases('json')">JSON</button>
          <button class="btn secondary" (click)="exportPurchases('excel')">Excel</button>
          <button class="btn secondary" (click)="exportPurchases('pdf')">PDF</button>
          <button class="btn secondary" (click)="load()">Actualizar</button>
        </div>
      </div>

      <div *ngIf="message()" class="success-box">{{ message() }}</div>
      <div *ngIf="error()" class="error-box">{{ error() }}</div>

      <div class="card">
        <div class="section-head">
          <div>
            <h3>Órdenes de compra</h3>
            <span class="muted">Resumen operativo</span>
          </div>
        </div>
        <div class="toolbar compact-toolbar">
          <input [(ngModel)]="reportSearch" placeholder="Filtrar por OC, proveedor, producto o estado" class="toolbar-input">
          <button class="btn secondary" (click)="exportPurchases('excel')">Exportar con filtro</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>OC</th>
                <th>Proveedor</th>
                <th>Estado</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of purchases()">
                <td>{{ row.numero_oc }}</td>
                <td>{{ row.proveedor }}</td>
                <td>{{ row.estado }}</td>
                <td>{{ row.total | number }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="card">
          <div class="section-head">
            <div>
              <h3>Nueva orden de compra</h3>
              <span class="muted">Puedes usar el código para cargar el producto</span>
            </div>
          </div>

          <div class="toolbar compact-toolbar">
            <input [(ngModel)]="orderBarcode" placeholder="Escanear código para orden" class="toolbar-input">
            <button class="btn secondary" (click)="resolveOrderBarcode()">Resolver</button>
          </div>

          <div class="notice" *ngIf="productPreview()">
            Producto detectado: <strong>{{ productPreview()?.product?.nombre_comercial || productPreview()?.nombre_comercial }}</strong>
          </div>

          <div class="form-grid">
            <label>
              Número OC
              <input [(ngModel)]="purchase.numero_oc">
            </label>
            <label>
              Proveedor (id)
              <input type="number" [(ngModel)]="purchase.id_proveedor">
            </label>
            <label>
              Producto (id)
              <input type="number" [(ngModel)]="purchase.items[0].id_producto">
            </label>
            <label>
              Cantidad
              <input type="number" [(ngModel)]="purchase.items[0].cantidad">
            </label>
            <label>
              Precio unitario
              <input type="number" [(ngModel)]="purchase.items[0].precio_unitario">
            </label>
          </div>

          <button class="btn" (click)="createPurchase()">Crear OC</button>
        </div>

        <div class="card">
          <div class="section-head">
            <div>
              <h3>Recepción por código de barras</h3>
              <span class="muted">Escanea producto, captura lote y vencimiento</span>
            </div>
          </div>

          <div class="toolbar compact-toolbar">
            <input [(ngModel)]="receptionBarcode" placeholder="Escanear código de producto" class="toolbar-input">
            <button class="btn secondary" (click)="resolveReceptionBarcode()">Resolver</button>
          </div>

          <div class="notice" *ngIf="receptionPreview() as preview">
            Recepción preparada para <strong>{{ preview.product?.nombre_comercial || preview.nombre_comercial }}</strong>
          </div>

          <div class="form-grid">
            <label>
              ID OC
              <input type="number" [(ngModel)]="reception.id_oc">
            </label>
            <label>
              Almacén
              <input type="number" [(ngModel)]="reception.id_almacen">
            </label>
            <label>
              Producto (id)
              <input type="number" [(ngModel)]="reception.items[0].id_producto">
            </label>
            <label>
              Lote
              <input [(ngModel)]="reception.items[0].numero_lote">
            </label>
            <label>
              Vencimiento
              <input type="date" [(ngModel)]="reception.items[0].fecha_vencimiento">
            </label>
            <label>
              Cantidad recibida
              <input type="number" [(ngModel)]="reception.items[0].cantidad_recibida">
            </label>
            <label>
              Costo unitario
              <input type="number" [(ngModel)]="reception.items[0].costo_unitario">
            </label>
          </div>

          <button class="btn success" (click)="receivePurchase()">Registrar recepción</button>
        </div>
      </div>
    </section>
  `
})
export class PurchasesComponent implements OnInit {
  readonly purchases = signal<any[]>([]);
  readonly productPreview = signal<any>(null);
  readonly receptionPreview = signal<any>(null);
  readonly message = signal('');
  readonly error = signal('');

  orderBarcode = '';
  receptionBarcode = '';
  reportSearch = '';

  purchase: any = {
    numero_oc: `OC-${Date.now()}`,
    id_proveedor: 1,
    items: [{ id_producto: 1, cantidad: 10, precio_unitario: 1500 }]
  };

  reception: any = {
    id_oc: 1,
    id_almacen: 1,
    items: [{
      id_producto: 1,
      numero_lote: `LOT-${Date.now()}`,
      fecha_vencimiento: '2027-12-31',
      cantidad_recibida: 10,
      costo_unitario: 1500
    }]
  };

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    void this.load();
  }

  async load() {
    try {
      this.error.set('');
      const response = await this.api.get<{ success: boolean; data: any[] }>('/purchases');
      this.purchases.set(response.data);
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible cargar las compras.');
    }
  }

  async resolveOrderBarcode() {
    if (!this.orderBarcode) return;
    try {
      this.error.set('');
      const response = await this.api.get<{ success: boolean; data: any }>(`/products/barcode/${encodeURIComponent(this.orderBarcode)}`);
      this.productPreview.set(response.data);
      this.purchase.items[0].id_producto = response.data.id_producto;
      this.purchase.items[0].precio_unitario = response.data.costo_referencia ?? response.data.precio_venta ?? this.purchase.items[0].precio_unitario;
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible resolver el código para la orden.');
    }
  }

  async resolveReceptionBarcode() {
    if (!this.receptionBarcode) return;
    try {
      this.error.set('');
      const response = await this.api.post<{ success: boolean; data: any }>('/inventory/barcode/resolve', {
        barcode: this.receptionBarcode,
        mode: 'ingreso',
        source: 'manual'
      });
      this.receptionPreview.set(response.data);
      this.reception.items[0].id_producto = response.data.product.id_producto;
      this.reception.items[0].costo_unitario = response.data.product.costo_referencia ?? this.reception.items[0].costo_unitario;
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible resolver el código para la recepción.');
    }
  }

  async createPurchase() {
    try {
      this.error.set('');
      await this.api.post('/purchases', this.purchase);
      this.message.set('Orden de compra creada.');
      await this.load();
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible crear la orden de compra.');
    }
  }

  async receivePurchase() {
    try {
      this.error.set('');
      await this.api.post(`/purchases/${this.reception.id_oc}/receive`, {
        id_almacen: this.reception.id_almacen,
        items: this.reception.items
      });
      this.message.set('Recepción registrada.');
      await this.load();
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible registrar la recepción.');
    }
  }

  async exportPurchases(format: ExportFormat) {
    try {
      this.error.set('');
      const extension = format === 'excel' ? 'xls' : format;
      await this.api.download(
        `/reports/purchases/export?format=${format}&search=${encodeURIComponent(this.reportSearch)}`,
        `akripharmacy-compras.${extension}`
      );
      this.message.set(`Compras exportadas en formato ${format.toUpperCase()}.`);
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible exportar las compras.');
    }
  }
}
