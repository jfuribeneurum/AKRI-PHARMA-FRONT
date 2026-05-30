import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

type ExportFormat = 'json' | 'excel' | 'pdf';
type ReportKey =
  | 'dashboard'
  | 'inventory'
  | 'sales'
  | 'purchases'
  | 'expirations'
  | 'coldChain'
  | 'siesaBilling'
  | 'controlled'
  | 'barcodeTrace'
  | 'productImages'
  | 'dispensing';

@Component({
  selector: 'akri-reports',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.css']
})
export class ReportsComponent {
  readonly message = signal('');
  readonly error = signal('');

  inventorySearch = '';
  salesSearch = '';
  purchasesSearch = '';
  expirationDays = 180;
  coldChainHours = 72;
  siesaSearch = '';
  controlledSearch = '';
  controlledDays = 365;
  barcodeSearch = '';
  barcodeDays = 30;
  productImagesSearch = '';
  dispensingSearch = '';

  constructor(private readonly api: ApiService) {}

  async exportDashboard(format: ExportFormat) {
    await this.downloadReport('dashboard', format, '/reports/dashboard/export');
  }

  async exportInventory(format: ExportFormat) {
    await this.downloadReport('inventory', format, '/reports/inventory/export', { search: this.inventorySearch });
  }

  async exportSales(format: ExportFormat) {
    await this.downloadReport('sales', format, '/reports/sales/export', { search: this.salesSearch });
  }

  async exportPurchases(format: ExportFormat) {
    await this.downloadReport('purchases', format, '/reports/purchases/export', { search: this.purchasesSearch });
  }

  async exportExpirations(format: ExportFormat) {
    await this.downloadReport('expirations', format, '/reports/expirations/export', { days: this.expirationDays });
  }

  async exportColdChain(format: ExportFormat) {
    await this.downloadReport('coldChain', format, '/reports/cold-chain/export', { hours: this.coldChainHours });
  }

  async exportSiesaBilling(format: ExportFormat) {
    await this.downloadReport('siesaBilling', format, '/reports/siesa-billing/export', { search: this.siesaSearch });
  }

  async exportControlled(format: ExportFormat) {
    await this.downloadReport('controlled', format, '/reports/controlled/export', {
      search: this.controlledSearch,
      days: this.controlledDays
    });
  }

  async exportBarcodeTrace(format: ExportFormat) {
    await this.downloadReport('barcodeTrace', format, '/reports/barcode-trace/export', {
      search: this.barcodeSearch,
      days: this.barcodeDays
    });
  }

  async exportProductImages(format: ExportFormat) {
    await this.downloadReport('productImages', format, '/reports/product-images/export', { search: this.productImagesSearch });
  }

  async exportDispensing(format: ExportFormat) {
    await this.downloadReport('dispensing', format, '/reports/dispensing/export', { search: this.dispensingSearch });
  }

  private async downloadReport(kind: ReportKey, format: ExportFormat, path: string, params: Record<string, string | number> = {}) {
    try {
      this.error.set('');
      this.message.set('');
      const query = new URLSearchParams({ format });
      for (const [key, value] of Object.entries(params)) {
        const text = String(value ?? '').trim();
        if (text) {
          query.set(key, text);
        }
      }
      const extension = format === 'excel' ? 'xls' : format;
      await this.api.download(`${path}?${query.toString()}`, `akripharmacy-${kind}.${extension}`);
      this.message.set(`Reporte ${this.labelFor(kind)} exportado en formato ${format.toUpperCase()}.`);
    } catch (error: any) {
      this.error.set(error?.error?.message || `No fue posible exportar ${this.labelFor(kind)}.`);
    }
  }

  private labelFor(kind: ReportKey): string {
    const labels: Record<ReportKey, string> = {
      dashboard: 'dashboard',
      inventory: 'inventario',
      sales: 'ventas',
      purchases: 'compras',
      expirations: 'vencimientos',
      coldChain: 'cadena de frío',
      siesaBilling: 'facturación SIESA',
      controlled: 'controlados',
      barcodeTrace: 'trazabilidad de escaneos',
      productImages: 'imágenes por producto',
      dispensing: 'dispensación'
    };
    return labels[kind] ?? 'reporte';
  }
}
