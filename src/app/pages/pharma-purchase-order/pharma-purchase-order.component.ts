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

const EDITABLE_STATES = ['borrador', 'enviada', 'editada'];

@Component({
  selector: 'akri-pharma-purchase-order',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pharma-purchase-order.component.html',
  styleUrls: ['./pharma-purchase-order.component.css'],
  imports: [CommonModule, FormsModule, UppercaseInputDirective]
})
export class PharmaPurchaseOrderComponent implements OnInit {
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
  readonly showSuccessModal = signal(false);
  readonly createdOcNumber = signal('');
  readonly successModalTitle = signal('¡Orden creada!');
  readonly successModalSubtitle = signal('La orden de compra fue registrada correctamente.');
  readonly editingOrderId = signal<number | null>(null);
  readonly pdfGenerando = signal<number | null>(null);
  tiposIdentificacion: { valor: string; etiqueta: string }[] = [];

  readonly isEditMode = computed(() => this.editingOrderId() !== null);

  readonly filterType = signal<'numero' | 'fecha' | 'laboratorio'>('numero');
  filter = { numero_oc: '', fecha_desde: '', fecha_hasta: '', laboratorio: '', estado: '' };

  readonly estadoOptions = [
    { value: 'enviada', label: 'Enviada' },
    { value: 'editada', label: 'Editada' },
    { value: 'aprobada', label: 'Aprobada' },
    { value: 'cancelada', label: 'Cancelada' }
  ];

  setFilterType(type: 'numero' | 'fecha' | 'laboratorio') {
    this.filterType.set(type);
    // Mantiene el filtro de estado al cambiar de tipo
    this.filter = { numero_oc: '', fecha_desde: '', fecha_hasta: '', laboratorio: '', estado: this.filter.estado };
    this.applyFilter();
  }

  toggleEstadoFilter(estado: string) {
    this.filter.estado = this.filter.estado === estado ? '' : estado;
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
    return this.labProducts().filter(
      (p) =>
        p.nombre_comercial === nombre &&
        (p.concentracion ?? '') === concentracion
    );
  }

  isEditable(estado: string) {
    return EDITABLE_STATES.includes(estado);
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
    } catch { /* non-fatal */ }
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

    const labs = this.labsForProduct(key);
    if (labs.length === 1) {
      this.onLabSelect(item, String(labs[0].id_producto));
    }
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
    const estado = this.filter.estado;

    this.filtered.set(
      this.allOrders().filter(row => {
        if (num && !String(row.numero_oc ?? '').toLowerCase().includes(num)) return false;
        if (desde && String(row.fecha ?? '') < desde) return false;
        if (hasta && String(row.fecha ?? '') > hasta) return false;
        if (lab && !String(row.observaciones ?? '').toLowerCase().includes(lab)) return false;
        if (estado && row.estado !== estado) return false;
        return true;
      })
    );
  }

  clearFilter() {
    this.filter = { numero_oc: '', fecha_desde: '', fecha_hasta: '', laboratorio: '', estado: '' };
    this.applyFilter();
  }

  itemTotal(item: OrderItem): number {
    return (item.cantidad ?? 0) * (item.valor_unitario ?? 0);
  }

  grandTotal(): number {
    return this.items.reduce((sum, item) => sum + this.itemTotal(item), 0);
  }

  totalIva(): number {
    return this.items.reduce((sum, item) => {
      const prod = this.labProducts().find(p => p.id_producto === item.id_producto);
      const tasa = Number(prod?.iva_tasa ?? 0);
      const rate = tasa >= 1 ? tasa : 0;
      return sum + (this.itemTotal(item) * rate / 100);
    }, 0);
  }

  totalOrdenCompra(): number {
    return this.grandTotal() + this.totalIva();
  }

  addItem() {
    this.items.push({ id_producto: 0, product_key: '', codigo: '', nombre: '', laboratorio: '', cantidad: 0, valor_unitario: 0, precio_venta: 0, costo_referencia: 0 });
  }

  removeItem(index: number) {
    this.items.splice(index, 1);
  }

  private resetForm() {
    this.editingOrderId.set(null);
    this.order = {
      consecutivo: '',
      fecha: new Date().toISOString().slice(0, 10),
      id_almacen: null,
      sede: '', bodega: '', direccion_sede: '', ciudad_sede: '',
      id_proveedor: null, id_laboratorio_proveedor: null,
      proveedor_razon_social: '', proveedor_tipo_id: 'NIT',
      proveedor_numero_id: '', proveedor_digito_verificacion: '',
      proveedor_nombres: '', proveedor_apellidos: '',
      proveedor_telefono: '', proveedor_ciudad: '',
      proveedor_direccion: '', observaciones: ''
    };
    this.items = [{ id_producto: 0, product_key: '', codigo: '', nombre: '', laboratorio: '', cantidad: 0, valor_unitario: 0, precio_venta: 0, costo_referencia: 0 }];
  }

  async toggleForm() {
    const opening = !this.showForm();
    if (opening) {
      this.resetForm();
      try {
        const res: any = await this.api.get('/purchases/next-number');
        this.order.consecutivo = res?.data?.numero_oc ?? res?.numero_oc ?? '';
      } catch { /* non-fatal */ }
      void this.loadAllProducts();
    }
    this.showForm.set(opening);
  }

  async loadOrderForEdit(orderId: number) {
    this.error.set('');
    try {
      const res: any = await this.api.get(`/purchases/${orderId}`);
      const oc = res?.data ?? res;

      this.editingOrderId.set(orderId);
      this.order.consecutivo = oc.numero_oc;
      this.order.fecha = oc.fecha?.slice(0, 10) ?? '';
      this.order.id_proveedor = oc.id_proveedor;
      this.order.id_laboratorio_proveedor = null;

      const prov = this.allProviders().find(p => p.id_proveedor === oc.id_proveedor);
      if (prov) {
        this.order.id_laboratorio_proveedor = prov.id_laboratorio ?? null;
        this.order.proveedor_razon_social = prov.razon_social ?? prov.nombre ?? '';
        this.order.proveedor_tipo_id = prov.tipo_identificacion ?? 'NIT';
        this.order.proveedor_numero_id = prov.numero_identificacion ?? '';
        this.order.proveedor_digito_verificacion = prov.digito_verificacion ?? '';
        this.order.proveedor_nombres = prov.nombres ?? '';
        this.order.proveedor_apellidos = prov.apellidos ?? '';
        this.order.proveedor_telefono = prov.telefono ?? '';
        this.order.proveedor_ciudad = prov.ciudad ?? '';
        this.order.proveedor_direccion = prov.direccion ?? '';
      } else {
        this.order.proveedor_razon_social = oc.proveedor_nombre ?? '';
      }

      this.order.sede = oc.sede_nombre ?? '';
      this.order.direccion_sede = oc.sede_direccion ?? '';
      this.order.ciudad_sede = oc.sede_ciudad ?? '';

      const wh = this.allWarehouses().find(w => String(w.id_sede) === String(oc.id_sede));
      this.order.id_almacen = wh?.id_almacen ?? null;
      if (wh) this.order.bodega = wh.nombre;

      // Extraer solo las notas del usuario (antes del bloque de items)
      const rawObs = oc.observaciones ?? '';
      const itemsIdx = rawObs.indexOf('\nItem ');
      this.order.observaciones = itemsIdx > -1 ? rawObs.slice(0, itemsIdx).trim() : rawObs;

      this.items = (oc.items ?? []).map((item: any) => ({
        id_producto: item.id_producto,
        product_key: `${item.nombre_comercial}|${item.concentracion ?? ''}`,
        codigo: item.codigo ?? '',
        nombre: item.nombre_comercial ?? '',
        laboratorio: item.laboratorio_nombre ?? '',
        cantidad: item.cantidad,
        valor_unitario: item.precio_unitario,
        precio_venta: item.precio_venta ?? 0,
        costo_referencia: item.costo_referencia ?? 0
      }));
      if (this.items.length === 0) this.addItem();

      if (!this.showForm()) {
        void this.loadAllProducts();
        this.showForm.set(true);
      }

      setTimeout(() => {
        document.querySelector('.new-order-toggle')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } catch (err: any) {
      console.error('[loadOrderForEdit]', err);
      this.error.set(err?.error?.message ?? err?.message ?? 'No se pudo cargar la orden para editar.');
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

  async saveOrder() {
    this.error.set('');
    this.message.set('');

    const validItems = this.items.filter(i => Number(i.cantidad) > 0 && Number(i.id_producto) > 0);
    if (validItems.length === 0) {
      this.error.set('Debe agregar al menos un item con producto y cantidad válidos.');
      return;
    }

    this.saving.set(true);
    try {
      const editId = this.editingOrderId();
      let result: any;
      if (editId) {
        result = await this.api.put(`/purchases/${editId}`, this.buildPayload());
        this.successModalTitle.set('¡Orden actualizada!');
        this.successModalSubtitle.set('La orden de compra fue actualizada correctamente.');
      } else {
        result = await this.api.post('/purchases', this.buildPayload());
        this.successModalTitle.set('¡Orden creada!');
        this.successModalSubtitle.set('La orden de compra fue registrada correctamente.');
      }
      const numero = result?.data?.numero_oc ?? result?.numero_oc ?? this.order.consecutivo;
      this.createdOcNumber.set(numero);
      await this.loadOrders();
      this.showSuccessModal.set(true);
      setTimeout(() => this.dismissSuccess(), 4000);
    } catch (err: any) {
      console.error('[saveOrder]', err);
      this.error.set(err?.error?.message ?? err?.message ?? 'No fue posible guardar la orden de compra.');
    } finally {
      this.saving.set(false);
    }
  }

  dismissSuccess() {
    this.showSuccessModal.set(false);
    this.showForm.set(false);
    this.resetForm();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async approveOrder(id: number, numero: string) {
    if (!confirm(`¿Aprobar la orden ${numero}? Una vez aprobada no podrá editarse ni cancelarse.`)) return;
    this.error.set('');
    try {
      await this.api.patch(`/purchases/${id}/approve`, {});
      await this.loadOrders();
    } catch (err: any) {
      this.error.set(err?.error?.message || 'No se pudo aprobar la orden.');
    }
  }

  async cancelOrder(id: number, numero: string) {
    if (!confirm(`¿Cancelar la orden ${numero}? Esta acción no se puede revertir.`)) return;
    this.error.set('');
    try {
      await this.api.patch(`/purchases/${id}/cancel`, {});
      await this.loadOrders();
    } catch (err: any) {
      this.error.set(err?.error?.message || 'No se pudo cancelar la orden.');
    }
  }

  // Genera el documento formal de la orden de compra para enviar al
  // proveedor. No se guarda en el servidor: se arma en el navegador (igual
  // que los soportes de Dispensación) y se abre en una pestaña nueva, desde
  // donde se imprime o se guarda como PDF con el diálogo del navegador.
  async generarPdfOrden(row: any) {
    if (this.pdfGenerando() != null) return;
    this.error.set('');
    this.pdfGenerando.set(row.id_oc);
    try {
      const res: any = await this.api.get(`/purchases/${row.id_oc}`);
      const oc = res?.data ?? res;
      const prov = this.allProviders().find(p => p.id_proveedor === oc.id_proveedor);

      // La orden guarda las notas del usuario y un bloque de metadatos de
      // texto libre juntos en observaciones (ver buildPayload): "notas +
      // Item 1: ... + Sede: ...". Cuando no hay notas del usuario, el texto
      // empieza directo en "Item 1:" (sin salto de línea previo), así que
      // buscar solo "\nItem " lo pasa por alto y termina mostrando todo el
      // bloque técnico en el PDF — se busca también el caso "^Item 1:".
      const rawObs: string = oc.observaciones ?? '';
      const itemsMatch = rawObs.search(/(?:^|\n\n)Item 1: /);
      const notas = (itemsMatch > -1 ? rawObs.slice(0, itemsMatch) : rawObs).trim();

      const html = this.buildOrdenCompraHtml(oc, prov, notas);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'No fue posible generar el PDF de la orden.');
    } finally {
      this.pdfGenerando.set(null);
    }
  }

  // Diseño calcado del formato de Orden de Compra que ya se usa en la
  // operación real (tablas densas con borde, bloque de firmas al pie) — no
  // el estilo de tarjeta a color usado en los soportes de Dispensación.
  private buildOrdenCompraHtml(oc: any, prov: any, notas: string): string {
    const ahora = new Date();
    const horaGeneracion = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
    const fechaGeneracion = ahora.toLocaleDateString('es-CO');
    const fechaOc = oc.fecha ? new Date(oc.fecha).toLocaleDateString('es-CO') : '—';
    const items: any[] = Array.isArray(oc.items) ? oc.items : [];
    const money = (n: number) => Number(n ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const identificacion = prov
      ? `${prov.tipo_identificacion ?? ''} ${prov.numero_identificacion ?? ''}${prov.digito_verificacion ? '-' + prov.digito_verificacion : ''}`.trim()
      : '—';

    const totalItems = items.reduce((s, it) => s + Number(it.cantidad ?? 0) * Number(it.precio_unitario ?? 0), 0);

    // Bod. / % Dct / % IVA / % INC / % Csm no se registran hoy por ítem en
    // el módulo de órdenes de compra (impuesto/descuento siempre se guardan
    // en 0, ver buildPayload) — se muestran en 0.00 reflejando el dato real
    // guardado, no un valor inventado.
    const filasHtml = items.map(it => `
      <tr>
        <td>${it.codigo ?? '—'}</td>
        <td>${it.nombre_comercial ?? '—'}${it.concentracion ? ' ' + it.concentracion : ''}</td>
        <td>${it.laboratorio_nombre ?? '—'}</td>
        <td style="text-align:center;">—</td>
        <td style="text-align:right;">0.00</td>
        <td style="text-align:right;">0.00</td>
        <td style="text-align:right;">0.00</td>
        <td style="text-align:right;">0.00</td>
        <td style="text-align:right;">${Number(it.cantidad ?? 0).toFixed(2)}</td>
        <td style="text-align:right;">${money(it.precio_unitario)}</td>
        <td style="text-align:right;">${money(Number(it.cantidad ?? 0) * Number(it.precio_unitario ?? 0))}</td>
      </tr>
    `).join('');

    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Orden de Compra ${oc.numero_oc}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color:#111827; margin:0; padding:1.5rem; background:#e5e7eb; font-size:0.78rem; }
  .doc { max-width:1000px; margin:0 auto; background:#fff; padding:1.25rem 1.5rem 2rem; box-shadow:0 2px 12px rgba(0,0,0,0.12); }
  .doc-header { position:relative; text-align:center; padding-bottom:0.5rem; }
  .doc-header .company { font-weight:800; font-size:1rem; margin-bottom:2px; }
  .doc-header .company-line { font-size:0.78rem; }
  .doc-header .doc-title-main { margin:0.5rem 0 0; font-size:1.05rem; font-weight:800; letter-spacing:0.03em; }
  .doc-header .header-right { position:absolute; top:0; right:0; text-align:right; font-size:0.78rem; }
  .page-info-row { display:flex; justify-content:space-between; font-size:0.75rem; margin:0.6rem 0; }
  table.info { width:100%; border-collapse:collapse; margin-bottom:0.6rem; }
  table.info th, table.info td { border:1px solid #9ca3af; padding:0.3rem 0.5rem; font-size:0.78rem; text-align:left; }
  table.info th { background:#e5e7eb; font-weight:700; white-space:nowrap; width:1%; }
  table.items { width:100%; border-collapse:collapse; margin-top:0.4rem; font-size:0.75rem; }
  table.items th { background:#e5e7eb; border:1px solid #9ca3af; padding:0.35rem 0.4rem; font-weight:700; }
  table.items td { border:1px solid #9ca3af; padding:0.35rem 0.4rem; vertical-align:top; }
  table.items tfoot td { font-weight:800; border:1px solid #9ca3af; }
  .totales-wrap { display:flex; justify-content:flex-end; margin-top:0.6rem; }
  table.totales { border-collapse:collapse; min-width:320px; }
  table.totales td { border:1px solid #9ca3af; padding:0.3rem 0.6rem; font-size:0.78rem; }
  table.totales td:first-child { background:#e5e7eb; font-weight:700; }
  table.totales td:last-child { text-align:right; }
  table.totales tr.final td { font-weight:800; }
  .firmas { display:grid; grid-template-columns:repeat(2, 1fr); gap:1rem; margin-top:3rem; text-align:center; font-size:0.75rem; }
  .firmas .nombre { font-weight:700; min-height:1.1rem; margin-bottom:1.6rem; }
  .firmas .linea { border-top:1px solid #111827; padding-top:0.3rem; }
  .print-bar { max-width:1000px; margin:0 auto 0.75rem; text-align:right; }
  .print-bar button { background:#1d4ed8; color:#fff; border:none; padding:0.5rem 1rem; border-radius:6px; font-size:0.85rem; cursor:pointer; }
  @media print {
    .print-bar { display:none; }
    body { background:#fff; padding:0; }
    .doc { box-shadow:none; }
  }
</style>
</head>
<body>
  <div class="print-bar"><button onclick="window.print()">Imprimir / Guardar como PDF</button></div>
  <div class="doc">
    <div class="doc-header">
      <div class="header-right">
        <div>${fechaGeneracion}</div>
        <div>Hora: ${horaGeneracion}</div>
      </div>
      <div class="company">${oc.sede_nombre ?? 'AkriPharmacy'}</div>
      <div class="company-line">Dirección: ${oc.sede_direccion ?? '—'}</div>
      <div class="company-line">Ciudad: ${oc.sede_ciudad ?? '—'}</div>
      <div class="company-line">Teléfonos: ${oc.sede_telefono ?? '—'}</div>
      <div class="doc-title-main">ORDEN DE COMPRA</div>
    </div>

    <div class="page-info-row">
      <span>Página: 1 de 1</span>
      <span>Fecha de generación: ${fechaGeneracion} ${horaGeneracion}</span>
    </div>

    <table class="info">
      <tr>
        <th>Consecutivo :</th><td>${oc.numero_oc ?? '—'}</td>
        <th>Consecutivo BU :</th><td>—</td>
        <th>BU :</th><td>—</td>
      </tr>
      <tr>
        <th>Fecha :</th><td>${fechaOc}</td>
        <th>Fecha Entrega :</th><td>—</td>
        <th>Días de Plazo :</th><td>—</td>
      </tr>
      <tr>
        <th>Forma de Pago :</th><td>—</td>
        <th>Moneda :</th><td>COP - PESO COLOMBIANO</td>
        <th>Estado :</th><td>${oc.estado ?? '—'}</td>
      </tr>
      <tr>
        <th>Requisición :</th><td>—</td>
        <th>Doc/Rel :</th><td>—</td>
        <td colspan="2"></td>
      </tr>
      <tr>
        <th>Detalles :</th><td colspan="5">${oc.sede_direccion ?? '—'} — ${oc.sede_ciudad ?? '—'}</td>
      </tr>
    </table>

    <table class="info">
      <tr><th>Observaciones :</th><td colspan="3">${notas || '—'}</td></tr>
      <tr><th>Proveedor :</th><td colspan="3">${oc.proveedor_nombre ?? '—'}</td></tr>
      <tr>
        <th>Nit :</th><td>${identificacion}</td>
        <th>Teléfono :</th><td>${prov?.telefono ?? '—'}</td>
      </tr>
      <tr>
        <th>Dirección :</th><td>${prov?.direccion ?? '—'}${prov?.ciudad ? ' · ' + prov.ciudad : ''}</td>
        <th>Fax :</th><td>—</td>
      </tr>
    </table>

    <table class="items">
      <thead>
        <tr>
          <th>Código</th><th>Nombre</th><th>Presentación</th><th>Bod.</th>
          <th>% Dct</th><th>% IVA</th><th>% INC</th><th>% Csm</th>
          <th>Cantidad</th><th>V. Unidad</th><th>Total</th>
        </tr>
      </thead>
      <tbody>${filasHtml}</tbody>
      <tfoot>
        <tr>
          <td colspan="10">Total Items</td>
          <td style="text-align:right;">${money(totalItems)}</td>
        </tr>
      </tfoot>
    </table>

    <div class="totales-wrap">
      <table class="totales">
        <tr><td>Total Items:</td><td>${money(totalItems)}</td></tr>
        <tr><td>Total Descuento:</td><td>${money(0)}</td></tr>
        <tr><td>Sub-Total:</td><td>${money(oc.subtotal)}</td></tr>
        <tr><td>IVA:</td><td>${money(oc.impuestos)}</td></tr>
        <tr><td>INC:</td><td>${money(0)}</td></tr>
        <tr><td>Impuestos Aplicados:</td><td>${money(oc.impuestos)}</td></tr>
        <tr><td>Otros Costos:</td><td>${money(0)}</td></tr>
        <tr><td>Total Otros Conceptos:</td><td>${money(0)}</td></tr>
        <tr class="final"><td>TOTAL ORDEN DE COMPRA:</td><td>${money(oc.total)}</td></tr>
      </table>
    </div>

    <div class="firmas">
      <div>
        <div class="nombre">${oc.creado_por_nombre ?? ''}</div>
        <div class="linea">Elaborado Por</div>
      </div>
      <div>
        <div class="nombre">${oc.aprobado_por_nombre ?? ''}</div>
        <div class="linea">Aprobado Por</div>
      </div>
    </div>
  </div>
</body>
</html>`;
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
