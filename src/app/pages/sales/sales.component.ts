import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { BarcodeScannerComponent, BarcodeScanEvent } from '../../shared/barcode-scanner.component';
import { UppercaseInputDirective } from '../../shared/uppercase-input.directive';

type ExportFormat = 'json' | 'excel' | 'pdf';

@Component({
  selector: 'akri-sales',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, BarcodeScannerComponent, UppercaseInputDirective],
  templateUrl: './sales.component.html',
  styleUrls: ['./sales.component.css']
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
