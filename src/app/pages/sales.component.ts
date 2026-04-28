import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { BarcodeScannerComponent, BarcodeScanEvent } from '../shared/barcode-scanner.component';

type ExportFormat = 'json' | 'excel' | 'pdf';

@Component({
  selector: 'akri-sales',
  standalone: true,
  imports: [CommonModule, FormsModule, BarcodeScannerComponent],
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Ventas y dispensación</h1>
          <p class="page-subtitle">Opera ventas por lote, escaneo FEFO y exporta reportes en Excel, JSON y PDF.</p>
        </div>
        <div class="toolbar" style="margin-bottom: 0; justify-content: flex-end;">
          <button class="btn secondary" (click)="exportSales('json')">JSON</button>
          <button class="btn secondary" (click)="exportSales('excel')">Excel</button>
          <button class="btn secondary" (click)="exportSales('pdf')">PDF</button>
          <button class="btn secondary" (click)="load()">Actualizar</button>
        </div>
      </div>

      <div *ngIf="message()" class="success-box" style="margin-bottom: 1rem;">{{ message() }}</div>
      <div *ngIf="error()" class="error-box" style="margin-bottom: 1rem;">{{ error() }}</div>

      <div class="grid grid-2">
        <div class="card">
          <div class="section-head">
            <div>
              <h3>Ventas recientes</h3>
              <p class="muted">Consulta rápida de dispensaciones y facturación asociada.</p>
            </div>
          </div>
          <div class="toolbar compact-toolbar">
            <input [(ngModel)]="reportSearch" placeholder="Filtrar por folio, cliente, paciente o estado" class="toolbar-input">
            <button class="btn secondary" (click)="exportSales('excel')">Exportar con filtro</button>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Cliente</th>
                  <th>Paciente</th>
                  <th>Estado</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of sales()">
                  <td>{{ row.folio_venta }}</td>
                  <td>{{ row.cliente }}</td>
                  <td>{{ row.paciente }}</td>
                  <td>{{ row.estado }}</td>
                  <td>{{ row.total | number }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="stack">
          <div class="card">
            <div class="section-head">
              <div>
                <h3>Resolución por código de barras</h3>
                <p class="muted">Carga el lote FEFO sugerido para la venta y reduce errores de digitación.</p>
              </div>
            </div>

            <akri-barcode-scanner (detected)="handleScan($event)" />

            <div *ngIf="scannedLookup() as vm" class="lookup-card" style="margin-top: 1rem;">
              <strong>{{ vm.product.nombre_comercial }}</strong><br>
              <span class="muted">{{ vm.product.sku }} · {{ vm.product.codigo_barras }}</span><br>
              <span class="muted" *ngIf="vm.suggestedLot">Lote sugerido: {{ vm.suggestedLot.numero_lote }} · stock {{ vm.suggestedLot.cantidad_disponible }}</span>
            </div>
          </div>

          <div class="card">
            <h3>Nueva venta</h3>

            <div class="form-grid">
              <label>
                Folio
                <input [(ngModel)]="sale.folio_venta">
              </label>
              <label>
                Cliente (id)
                <input type="number" [(ngModel)]="sale.id_cliente">
              </label>
              <label>
                Paciente (id)
                <input type="number" [(ngModel)]="sale.id_paciente">
              </label>
              <label>
                Receta (id)
                <input type="number" [(ngModel)]="sale.id_receta">
              </label>
              <label>
                Lote (id)
                <input type="number" [(ngModel)]="sale.items[0].id_lote">
              </label>
              <label>
                Cantidad
                <input type="number" [(ngModel)]="sale.items[0].cantidad">
              </label>
              <label>
                Precio
                <input type="number" [(ngModel)]="sale.items[0].precio_unitario">
              </label>
            </div>

            <div class="toolbar" style="margin-top: 1rem;">
              <label><input type="checkbox" [(ngModel)]="sale.requiere_factura"> Requiere factura</label>
            </div>

            <button class="btn accent" (click)="createSale()">Registrar venta</button>
          </div>
        </div>
      </div>
    </section>
  `
})
export class SalesComponent implements OnInit {
  sales = signal<any[]>([]);
  scannedLookup = signal<any | null>(null);
  message = signal('');
  error = signal('');

  reportSearch = '';

  sale: any = {
    folio_venta: `VTA-${Date.now()}`,
    id_cliente: 1,
    id_paciente: 1,
    id_receta: 1,
    metodo_pago: 'efectivo',
    requiere_factura: true,
    items: [{ id_lote: 1, cantidad: 1, precio_unitario: 4500 }]
  };

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    void this.load();
  }

  async load() {
    try {
      this.error.set('');
      const response = await this.api.get<{ success: boolean; data: any[] }>('/sales');
      this.sales.set(response.data);
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible cargar las ventas.');
    }
  }

  async handleScan(event: BarcodeScanEvent) {
    try {
      this.error.set('');
      const response = await this.api.post<{ success: boolean; data: any }>('/inventory/barcode/resolve', {
        barcode: event.code,
        mode: 'egreso',
        source: event.origin === 'camara' ? 'camara' : event.origin === 'manual' ? 'manual' : 'lector'
      });
      const payload = {
        ...response.data,
        suggestedLot: response.data?.lots?.[0] ?? null
      };
      this.scannedLookup.set(payload);
      const suggested = payload?.suggestedLot;
      if (suggested) {
        this.sale.items[0].id_lote = suggested.id_lote;
        this.sale.items[0].precio_unitario = suggested.precio_venta ?? response.data?.product?.precio_venta ?? 0;
      }
    } catch (error: any) {
      this.error.set(error?.error?.message ?? 'No fue posible resolver el producto para la venta.');
    }
  }

  async createSale() {
    try {
      this.error.set('');
      await this.api.post('/sales', this.sale);
      this.message.set('Venta registrada.');
      this.sale = {
        folio_venta: `VTA-${Date.now()}`,
        id_cliente: 1,
        id_paciente: 1,
        id_receta: 1,
        metodo_pago: 'efectivo',
        requiere_factura: true,
        items: [{ id_lote: 1, cantidad: 1, precio_unitario: 4500 }]
      };
      this.scannedLookup.set(null);
      await this.load();
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible registrar la venta.');
    }
  }

  async exportSales(format: ExportFormat) {
    try {
      this.error.set('');
      const extension = format === 'excel' ? 'xls' : format;
      await this.api.download(
        `/reports/sales/export?format=${format}&search=${encodeURIComponent(this.reportSearch)}`,
        `akripharmacy-ventas.${extension}`
      );
      this.message.set(`Ventas exportadas en formato ${format.toUpperCase()}.`);
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible exportar las ventas.');
    }
  }
}
