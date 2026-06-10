import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { UppercaseInputDirective } from '../../shared/uppercase-input.directive';

type ExportFormat = 'json' | 'excel' | 'pdf';

@Component({
  selector: 'akri-purchases',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UppercaseInputDirective],
  templateUrl: './purchases.component.html',
  styleUrls: ['./purchases.component.css']
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
