import { Component, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { UppercaseInputDirective } from '../../shared/uppercase-input.directive';

interface OrderItem {
  id_producto: number;
  product_key: string;
  codigo: string;
  nombre: string;
  laboratorio: string;
  cantidad: number;
  valor_unitario: number;
  precio_venta: number;
  costo_referencia: number;
}

@Component({
  selector: 'akri-sebas-purchase-order',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sebas-purchase-order.component.html',
  styleUrls: ['./sebas-purchase-order.component.css'],
  imports: [CommonModule, FormsModule, UppercaseInputDirective]
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
  readonly allWarehouses = signal<any[]>([]);
  readonly labProducts = signal<any[]>([]);
  tiposIdentificacion: { valor: string; etiqueta: string }[] = [];

  readonly filterType = signal<'numero' | 'fecha' | 'laboratorio'>('numero');
  filter = { numero_oc: '', fecha_desde: '', fecha_hasta: '', laboratorio: '' };

  setFilterType(type: 'numero' | 'fecha' | 'laboratorio') {
    this.filterType.set(type);
    this.filter = { numero_oc: '', fecha_desde: '', fecha_hasta: '', laboratorio: '' };
    this.applyFilter();
  }

  order: any = {
    consecutivo: '',
    fecha: new Date().toISOString().slice(0, 10),
    id_almacen: null,
    sede: '',
    bodega: '',
    direccion_sede: '',
    ciudad_sede: '',
    id_proveedor: null,
    id_laboratorio_proveedor: null,
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

  readonly uniqueProducts = computed(() => {
    const seen = new Map<string, { key: string; nombre_comercial: string; concentracion: string }>();
    for (const p of this.labProducts()) {
      const key = `${p.nombre_comercial}|${p.concentracion ?? ''}`;
      if (!seen.has(key)) seen.set(key, { key, nombre_comercial: p.nombre_comercial, concentracion: p.concentracion });
    }
    return Array.from(seen.values());
  });

  labsForProduct(key: string) {
    const [nombre, concentracion] = key.split('|');
    const idLab = this.order.id_laboratorio_proveedor;
    return this.labProducts().filter(
      (p) =>
        p.nombre_comercial === nombre &&
        (p.concentracion ?? '') === concentracion &&
        (idLab == null || p.id_laboratorio === idLab)
    );
  }

  items: OrderItem[] = [
    { id_producto: 0, product_key: '', codigo: '', nombre: '', laboratorio: '', cantidad: 0, valor_unitario: 0, precio_venta: 0, costo_referencia: 0 }
  ];

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    this.loadOrders();
    this.loadProviders();
    void this.loadTiposIdentificacion();
    void this.loadWarehouses();
  }

  private async loadWarehouses() {
    try {
      const res: any = await this.api.get('/purchases/warehouses');
      this.allWarehouses.set(res?.data ?? []);
    } catch { /* non-fatal */ }
  }

  onWarehouseChange(id: string) {
    const wh = this.allWarehouses().find((w) => String(w.id_almacen) === String(id));
    if (!wh) return;
    this.order.id_almacen = wh.id_almacen;
    this.order.bodega = wh.nombre;
    this.order.sede = wh.sede_nombre ?? '';
    this.order.direccion_sede = wh.sede_direccion ?? '';
    this.order.ciudad_sede = wh.sede_ciudad ?? '';
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
    this.order.id_laboratorio_proveedor = prov.id_laboratorio ?? null;
    this.order.proveedor_razon_social = prov.razon_social ?? prov.nombre ?? '';
    this.order.proveedor_tipo_id = prov.tipo_identificacion ?? 'NIT';
    this.order.proveedor_numero_id = prov.numero_identificacion ?? prov.nit ?? '';
    this.order.proveedor_digito_verificacion = prov.digito_verificacion ?? '';
    this.order.proveedor_nombres = prov.nombres ?? '';
    this.order.proveedor_apellidos = prov.apellidos ?? '';
    this.order.proveedor_telefono = prov.telefono ?? '';
    this.order.proveedor_ciudad = prov.ciudad ?? '';
    this.order.proveedor_direccion = prov.direccion ?? '';

    // Limpiar selección de lab en cada ítem al cambiar proveedor
    for (const item of this.items) {
      item.id_producto = 0;
      item.codigo = '';
      item.nombre = '';
      item.laboratorio = '';
    }

    if (this.items.length === 0) this.addItem();
  }

  private async loadLabProducts(idLaboratorio: number) {
    try {
      const res: any = await this.api.get(`/products/by-lab/${idLaboratorio}`);
      this.labProducts.set(res?.data ?? []);
    } catch { /* non-fatal */ }
  }

  onProductKeySelect(item: any, key: string) {
    item.product_key = key;
    item.id_producto = 0;
    item.codigo = '';
    item.nombre = '';
    item.laboratorio = '';
    item.valor_unitario = 0;
    item.precio_venta = 0;
    item.costo_referencia = 0;
  }

  onLabSelect(item: any, idProducto: string) {
    const prod = this.labProducts().find((p) => String(p.id_producto) === String(idProducto));
    if (!prod) return;
    item.id_producto = prod.id_producto;
    item.codigo = prod.codigo_control ?? prod.sku ?? '';
    item.nombre = prod.nombre_comercial ?? '';
    item.laboratorio = prod.laboratorio_nombre ?? '';
    item.valor_unitario = Number(prod.costo_referencia ?? 0);
    item.precio_venta = Number(prod.precio_venta ?? 0);
    item.costo_referencia = Number(prod.costo_referencia ?? 0);
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
    this.items.push({ id_producto: 0, product_key: '', codigo: '', nombre: '', laboratorio: '', cantidad: 0, valor_unitario: 0, precio_venta: 0, costo_referencia: 0 });
  }

  removeItem(index: number) {
    this.items.splice(index, 1);
  }

  async toggleForm() {
    const opening = !this.showForm();
    this.showForm.set(opening);
    if (opening) {
      try {
        const res: any = await this.api.get('/purchases/next-number');
        this.order.consecutivo = res?.data?.numero_oc ?? res?.numero_oc ?? '';
      } catch { /* non-fatal */ }
      void this.loadAllProducts();
    }
  }

  private async loadAllProducts() {
    try {
      const res: any = await this.api.get('/products/for-po');
      this.labProducts.set(res?.data ?? []);
      if (this.items.length === 0) {
        this.addItem();
      }
    } catch { /* non-fatal */ }
  }

  async createPurchase() {
    this.error.set('');
    this.message.set('');
    this.saving.set(true);
    try {
      const result: any = await this.api.post('/purchases', this.buildPayload());
      const numeroCreado = result?.data?.numero_oc ?? result?.numero_oc ?? '';
      this.order.consecutivo = numeroCreado;
      this.message.set(`Orden de compra ${numeroCreado} creada correctamente.`);
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
          precio_venta: Number(i.precio_venta ?? 0),
          costo_referencia: Number(i.costo_referencia ?? 0),
          descuento: 0,
          impuesto: 0,
          fecha_requerida: null
        }))
    };
  }
}
