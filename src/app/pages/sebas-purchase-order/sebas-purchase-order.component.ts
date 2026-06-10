import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sebas-purchase-order.component.html',
  styleUrls: ['./sebas-purchase-order.component.css'],
  imports: [CommonModule, FormsModule]
})
export class SebasPurchaseOrderComponent implements OnInit {
  readonly message = signal('');
  readonly error = signal('');
  readonly saving = signal(false);
  readonly loading = signal(false);
  readonly showForm = signal(false);
  readonly allOrders = signal<any[]>([]);
  readonly filtered = signal<any[]>([]);
  readonly allProviders = signal<any[]>([]);
  tiposIdentificacion: { valor: string; etiqueta: string }[] = [];

  readonly filterType = signal<'numero' | 'fecha' | 'laboratorio'>('numero');
  filter = { numero_oc: '', fecha_desde: '', fecha_hasta: '', laboratorio: '' };

  setFilterType(type: 'numero' | 'fecha' | 'laboratorio') {
    this.filterType.set(type);
    this.filter = { numero_oc: '', fecha_desde: '', fecha_hasta: '', laboratorio: '' };
    this.applyFilter();
  }

  order: any = {
    consecutivo: `OC-${Date.now()}`,
    fecha: new Date().toISOString().slice(0, 10),
    sede: '',
    bodega: '',
    direccion_sede: '',
    ciudad_sede: '',
    id_proveedor: null,
    proveedor_razon_social: '',
    proveedor_tipo_id: 'NIT',
    proveedor_numero_id: '',
    proveedor_digito_verificacion: '',
    proveedor_nombres: '',
    proveedor_apellidos: '',
    proveedor_telefono: '',
    proveedor_ciudad: '',
    proveedor_direccion: '',
    observaciones: ''
  };

  items: OrderItem[] = [
    { id_producto: 0, codigo: '', nombre: '', laboratorio: '', cantidad: 0, valor_unitario: 0 }
  ];

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    this.loadOrders();
    this.loadProviders();
    void this.loadTiposIdentificacion();
  }

  private async loadTiposIdentificacion() {
    try {
      const res = await this.api.get<{ success: boolean; data: { valor: string; etiqueta: string }[] }>('/parametros/tipo_identificacion/activos');
      this.tiposIdentificacion = res.data ?? [];
    } catch { /* non-fatal */ }
  }

  async loadProviders() {
    try {
      const resp: any = await this.api.get('/providers');
      this.allProviders.set(Array.isArray(resp) ? resp : (resp?.data ?? []));
    } catch {
      // providers list is optional, order can still be created manually
    }
  }

  onProviderChange(id: string) {
    const prov = this.allProviders().find((p) => String(p.id_proveedor) === String(id));
    if (!prov) return;
    this.order.id_proveedor = prov.id_proveedor;
    this.order.proveedor_razon_social = prov.razon_social ?? prov.nombre ?? '';
    this.order.proveedor_tipo_id = prov.tipo_identificacion ?? 'NIT';
    this.order.proveedor_numero_id = prov.numero_identificacion ?? prov.nit ?? '';
    this.order.proveedor_digito_verificacion = prov.digito_verificacion ?? '';
    this.order.proveedor_nombres = prov.nombres ?? '';
    this.order.proveedor_apellidos = prov.apellidos ?? '';
    this.order.proveedor_telefono = prov.telefono ?? '';
    this.order.proveedor_ciudad = prov.ciudad ?? '';
    this.order.proveedor_direccion = prov.direccion ?? '';
  }

  async loadOrders() {
    this.loading.set(true);
    try {
      const resp: any = await this.api.get<any>('/purchases');
      const lista = Array.isArray(resp) ? resp : (resp?.data ?? []);
      this.allOrders.set(lista);
      this.applyFilter();
    } catch (err: any) {
      this.error.set(err?.error?.message || 'No se pudieron cargar las órdenes.');
    } finally {
      this.loading.set(false);
    }
  }

  applyFilter() {
    const num = this.filter.numero_oc.toLowerCase().trim();
    const desde = this.filter.fecha_desde.trim();
    const hasta = this.filter.fecha_hasta.trim();
    const lab = this.filter.laboratorio.toLowerCase().trim();

    this.filtered.set(
      this.allOrders().filter(row => {
        if (num && !String(row.numero_oc ?? '').toLowerCase().includes(num)) return false;
        if (desde && String(row.fecha ?? '') < desde) return false;
        if (hasta && String(row.fecha ?? '') > hasta) return false;
        if (lab && !String(row.observaciones ?? '').toLowerCase().includes(lab)) return false;
        return true;
      })
    );
  }

  clearFilter() {
    this.filter = { numero_oc: '', fecha_desde: '', fecha_hasta: '', laboratorio: '' };
    this.applyFilter();
  }

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
      await this.loadOrders();
    } catch (err: any) {
      this.error.set(err?.error?.message || 'No fue posible crear la orden de compra.');
    } finally {
      this.saving.set(false);
    }
  }

  private buildPayload() {
    const itemLines = this.items
      .filter(i => i.cantidad > 0)
      .map((i, idx) =>
        `Item ${idx + 1}: codigo=${i.codigo} | nombre=${i.nombre} | laboratorio=${i.laboratorio} | cantidad=${i.cantidad} | valor_unitario=${i.valor_unitario}`
      )
      .join('\n');

    const meta = [
      `Sede: ${this.order.sede}`,
      `Bodega: ${this.order.bodega}`,
      `Direccion sede: ${this.order.direccion_sede}`,
      `Ciudad: ${this.order.ciudad_sede}`,
      `Proveedor: ${this.order.proveedor_razon_social}`,
      `${this.order.proveedor_tipo_id}: ${this.order.proveedor_numero_id}${this.order.proveedor_digito_verificacion ? '-' + this.order.proveedor_digito_verificacion : ''}`,
      `Contacto: ${this.order.proveedor_nombres} ${this.order.proveedor_apellidos}`.trim(),
      `Telefono: ${this.order.proveedor_telefono}`,
      `Ciudad proveedor: ${this.order.proveedor_ciudad}`,
      `Direccion proveedor: ${this.order.proveedor_direccion}`,
      `Total OC: ${this.grandTotal()}`
    ].filter(line => !line.endsWith(': ') && !line.endsWith(': -')).join('\n');

    const notes = [this.order.observaciones?.trim(), itemLines, meta]
      .filter(Boolean)
      .join('\n\n');

    return {
      numero_oc: this.order.consecutivo,
      id_proveedor: Number(this.order.id_proveedor) || 1,
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
