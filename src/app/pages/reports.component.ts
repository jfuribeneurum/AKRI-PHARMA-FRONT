import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

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
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Centro de reportes y exportaciones</h1>
          <p class="page-subtitle">Descarga datasets operativos, regulatorios y de trazabilidad en JSON, Excel o PDF para análisis, auditoría y conciliación.</p>
        </div>
        <div class="toolbar" style="margin-bottom: 0; justify-content: flex-end; flex-wrap: wrap;">
          <span class="chip primary">Ventas</span>
          <span class="chip info">Compras</span>
          <span class="chip warn">Vencimientos</span>
          <span class="chip accent">Cadena de frío</span>
          <span class="chip success">SIESA</span>
          <span class="chip accent">Controlados</span>
        </div>
      </div>

      @if (message()) { <div class="success-box" style="margin-bottom: 1rem;">{{ message() }}</div> }
      @if (error()) { <div class="error-box" style="margin-bottom: 1rem;">{{ error() }}</div> }

      <div class="grid grid-2">
        <div class="card">
          <div class="card-header">
            <div>
              <h3>Dashboard ejecutivo</h3>
              <p class="helper">KPIs operativos del inventario, criticidad, vencimientos, frío y trazabilidad.</p>
            </div>
          </div>
          <div class="form-actions">
            <button class="btn secondary" (click)="exportDashboard('json')">JSON</button>
            <button class="btn secondary" (click)="exportDashboard('excel')">Excel</button>
            <button class="btn secondary" (click)="exportDashboard('pdf')">PDF</button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h3>Inventario por lote</h3>
              <p class="helper">Stock por almacén y ubicación, listo para conciliaciones y auditorías.</p>
            </div>
          </div>
          <div class="form-grid">
            <label>
              Búsqueda
              <input [(ngModel)]="inventorySearch" placeholder="Producto, SKU, lote o código de barras">
            </label>
          </div>
          <div class="form-actions">
            <button class="btn secondary" (click)="exportInventory('json')">JSON</button>
            <button class="btn secondary" (click)="exportInventory('excel')">Excel</button>
            <button class="btn secondary" (click)="exportInventory('pdf')">PDF</button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h3>Ventas y dispensación</h3>
              <p class="helper">Filtra por folio, cliente, paciente, producto o SKU.</p>
            </div>
            <span class="chip info">Detalle por lote</span>
          </div>
          <div class="form-grid">
            <label>
              Búsqueda
              <input [(ngModel)]="salesSearch" placeholder="Folio, cliente, paciente, producto o SKU">
            </label>
          </div>
          <div class="form-actions">
            <button class="btn secondary" (click)="exportSales('json')">JSON</button>
            <button class="btn secondary" (click)="exportSales('excel')">Excel</button>
            <button class="btn secondary" (click)="exportSales('pdf')">PDF</button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h3>Compras y recepciones</h3>
              <p class="helper">Filtra por OC, proveedor, estado, producto o SKU.</p>
            </div>
            <span class="chip success">Abastecimiento</span>
          </div>
          <div class="form-grid">
            <label>
              Búsqueda
              <input [(ngModel)]="purchasesSearch" placeholder="OC, proveedor, estado, producto o SKU">
            </label>
          </div>
          <div class="form-actions">
            <button class="btn secondary" (click)="exportPurchases('json')">JSON</button>
            <button class="btn secondary" (click)="exportPurchases('excel')">Excel</button>
            <button class="btn secondary" (click)="exportPurchases('pdf')">PDF</button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h3>Vencimientos y riesgo de lote</h3>
              <p class="helper">Define el horizonte en días para priorizar redistribución, devolución o cuarentena.</p>
            </div>
            <span class="chip warn">Horizonte configurable</span>
          </div>
          <div class="form-grid">
            <label>
              Horizonte en días
              <input type="number" min="1" max="3650" [(ngModel)]="expirationDays">
            </label>
          </div>
          <div class="form-actions">
            <button class="btn secondary" (click)="exportExpirations('json')">JSON</button>
            <button class="btn secondary" (click)="exportExpirations('excel')">Excel</button>
            <button class="btn secondary" (click)="exportExpirations('pdf')">PDF</button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h3>Cadena de frío</h3>
              <p class="helper">Exporta equipos, lecturas y alertas según una ventana de horas reciente.</p>
            </div>
            <span class="chip accent">Periodo deslizante</span>
          </div>
          <div class="form-grid">
            <label>
              Últimas horas
              <input type="number" min="1" max="4320" [(ngModel)]="coldChainHours">
            </label>
          </div>
          <div class="form-actions">
            <button class="btn secondary" (click)="exportColdChain('json')">JSON</button>
            <button class="btn secondary" (click)="exportColdChain('excel')">Excel</button>
            <button class="btn secondary" (click)="exportColdChain('pdf')">PDF</button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h3>Facturación SIESA</h3>
              <p class="helper">Consolida facturas, detalle y bitácora de integración con el adaptador SIESA.</p>
            </div>
            <span class="chip success">Integración</span>
          </div>
          <div class="form-grid">
            <label>
              Búsqueda
              <input [(ngModel)]="siesaSearch" placeholder="Factura, folio de venta, cliente o estado">
            </label>
          </div>
          <div class="form-actions">
            <button class="btn secondary" (click)="exportSiesaBilling('json')">JSON</button>
            <button class="btn secondary" (click)="exportSiesaBilling('excel')">Excel</button>
            <button class="btn secondary" (click)="exportSiesaBilling('pdf')">PDF</button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h3>Libro de controlados</h3>
              <p class="helper">Audita movimientos regulados, receta asociada, usuario responsable y stock vigente.</p>
            </div>
            <span class="chip accent">Regulatorio</span>
          </div>
          <div class="form-grid">
            <label>
              Búsqueda
              <input [(ngModel)]="controlledSearch" placeholder="Producto, SKU, lote, receta o referencia">
            </label>
            <label>
              Últimos días
              <input type="number" min="1" max="3650" [(ngModel)]="controlledDays">
            </label>
          </div>
          <div class="form-actions">
            <button class="btn secondary" (click)="exportControlled('json')">JSON</button>
            <button class="btn secondary" (click)="exportControlled('excel')">Excel</button>
            <button class="btn secondary" (click)="exportControlled('pdf')">PDF</button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h3>Trazabilidad de escaneos</h3>
              <p class="helper">Sigue ingresos, egresos y consultas por código de barras con usuario, lote y resultado.</p>
            </div>
            <span class="chip primary">Barcode</span>
          </div>
          <div class="form-grid">
            <label>
              Búsqueda
              <input [(ngModel)]="barcodeSearch" placeholder="Código, producto, SKU, lote o mensaje">
            </label>
            <label>
              Últimos días
              <input type="number" min="1" max="3650" [(ngModel)]="barcodeDays">
            </label>
          </div>
          <div class="form-actions">
            <button class="btn secondary" (click)="exportBarcodeTrace('json')">JSON</button>
            <button class="btn secondary" (click)="exportBarcodeTrace('excel')">Excel</button>
            <button class="btn secondary" (click)="exportBarcodeTrace('pdf')">PDF</button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h3>Imágenes adjuntas por producto</h3>
              <p class="helper">Mide cobertura visual del catálogo, origen de imágenes y productos aún sin evidencia.</p>
            </div>
            <span class="chip info">Media</span>
          </div>
          <div class="form-grid">
            <label>
              Búsqueda
              <input [(ngModel)]="productImagesSearch" placeholder="Producto, SKU, código de barras o origen">
            </label>
          </div>
          <div class="form-actions">
            <button class="btn secondary" (click)="exportProductImages('json')">JSON</button>
            <button class="btn secondary" (click)="exportProductImages('excel')">Excel</button>
            <button class="btn secondary" (click)="exportProductImages('pdf')">PDF</button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h3>Dispensación</h3>
              <p class="helper">Exporta recepciones, pacientes, domiciliarios, firma y detalle de medicamentos dispensados.</p>
            </div>
            <span class="chip accent">Firma digital</span>
          </div>
          <div class="form-grid">
            <label>
              Búsqueda
              <input [(ngModel)]="dispensingSearch" placeholder="Consecutivo, paciente, documento o receptor">
            </label>
          </div>
          <div class="form-actions">
            <button class="btn secondary" (click)="exportDispensing('json')">JSON</button>
            <button class="btn secondary" (click)="exportDispensing('excel')">Excel</button>
            <button class="btn secondary" (click)="exportDispensing('pdf')">PDF</button>
          </div>
        </div>

      </div>
    </section>
  `
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
    await this.downloadReport('inventory', format, '/reports/inventory/export', {
      search: this.inventorySearch
    });
  }

  async exportSales(format: ExportFormat) {
    await this.downloadReport('sales', format, '/reports/sales/export', {
      search: this.salesSearch
    });
  }

  async exportPurchases(format: ExportFormat) {
    await this.downloadReport('purchases', format, '/reports/purchases/export', {
      search: this.purchasesSearch
    });
  }

  async exportExpirations(format: ExportFormat) {
    await this.downloadReport('expirations', format, '/reports/expirations/export', {
      days: this.expirationDays
    });
  }

  async exportColdChain(format: ExportFormat) {
    await this.downloadReport('coldChain', format, '/reports/cold-chain/export', {
      hours: this.coldChainHours
    });
  }

  async exportSiesaBilling(format: ExportFormat) {
    await this.downloadReport('siesaBilling', format, '/reports/siesa-billing/export', {
      search: this.siesaSearch
    });
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
    await this.downloadReport('productImages', format, '/reports/product-images/export', {
      search: this.productImagesSearch
    });
  }

  async exportDispensing(format: ExportFormat) {
    await this.downloadReport('dispensing', format, '/reports/dispensing/export', {
      search: this.dispensingSearch
    });
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
    switch (kind) {
      case 'dashboard':
        return 'dashboard';
      case 'inventory':
        return 'inventario';
      case 'sales':
        return 'ventas';
      case 'purchases':
        return 'compras';
      case 'expirations':
        return 'vencimientos';
      case 'coldChain':
        return 'cadena de frío';
      case 'siesaBilling':
        return 'facturación SIESA';
      case 'controlled':
        return 'controlados';
      case 'barcodeTrace':
        return 'trazabilidad de escaneos';
      case 'productImages':
        return 'imágenes por producto';
      case 'dispensing':
        return 'dispensación';
      default:
        return 'reporte';
    }
  }
}
