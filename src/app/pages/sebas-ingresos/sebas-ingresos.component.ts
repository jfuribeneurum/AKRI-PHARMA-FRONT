import { Component, OnInit, signal, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { UppercaseInputDirective } from '../../shared/uppercase-input.directive';

@Component({
  selector: 'akri-sebas-ingresos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sebas-ingresos.component.html',
  styleUrls: ['./sebas-ingresos.component.css'],
  imports: [CommonModule, FormsModule, DatePipe, UppercaseInputDirective]
})
export class SebasIngresosComponent implements OnInit {
  readonly message = signal('');
  readonly error = signal('');
  readonly filterType = signal<'numero' | 'fecha' | 'laboratorio'>('numero');
  readonly modo = signal<'con_orden' | 'sin_orden' | null>(null);
  readonly cargandoOrdenes = signal(false);
  readonly todasLasOrdenes = signal<any[]>([]);
  readonly ordenesFiltradas = signal<any[]>([]);
  readonly ordenSeleccionada = signal<any>(null);

  // ── Lista de ingresos existentes ──────────────────────────────
  readonly cargandoIngresos = signal(false);
  readonly todosLosIngresos = signal<any[]>([]);
  readonly ingresosFiltrados = signal<any[]>([]);
  readonly expandedIngreso = signal<number | null>(null);

  filter = { numero_oc: '', fecha_desde: '', fecha_hasta: '', laboratorio: '' };
  ocSearch = '';

  ocMeta: any = this.emptyOcMeta();
  ocItems: any[] = [this.emptyOcItem()];
  ingresoExtra: any = this.emptyIngresoExtra();

  ingreso: any = this.emptyIngreso();
  factura: any = this.emptyFactura();

  constructor(private readonly api: ApiService, private readonly cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.cargarIngresos();
    this.cargarOrdenes();
  }

  // ── Carga y filtrado de ingresos existentes ───────────────────
  async cargarIngresos() {
    this.cargandoIngresos.set(true);
    try {
      const resp: any = await this.api.get<any>('/ingresos');
      const lista: any[] = Array.isArray(resp) ? resp : (resp?.data ?? []);
      const enriquecidos = lista.map(ing => this.enriquecerIngreso(ing));
      this.todosLosIngresos.set(enriquecidos);
      this.aplicarFiltro();
    } catch (err: any) {
      this.error.set(err?.error?.message || 'No se pudieron cargar los ingresos.');
    } finally {
      this.cargandoIngresos.set(false);
    }
  }

  private enriquecerIngreso(ing: any): any {
    const texto: string = ing.producto || '';
    const meta = this.parseMetaTexto(texto);
    const items = this.parseItemsTexto(texto);
    return {
      ...ing,
      _proveedor: meta['Proveedor'] || '',
      _sede: meta['Sede'] || '',
      _orden: meta['Orden'] || '',
      _laboratorio: meta['Laboratorio'] || (items[0]?.laboratorio || ''),
      _items_count: items.length,
      _primer_producto: items[0]?.nombre || '',
      _items: items,
    };
  }

  private parseMetaTexto(texto: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const line of texto.split('\n')) {
      if (line.startsWith('Item ')) continue;
      const idx = line.indexOf(':');
      if (idx > 0) result[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    return result;
  }

  private parseItemsTexto(texto: string): any[] {
    const items: any[] = [];
    let i = 1;
    while (true) {
      const prefix = `Item ${i}:`;
      const lineIdx = texto.indexOf(prefix);
      if (lineIdx === -1) break;
      const lineEnd = texto.indexOf('\n', lineIdx);
      const linea = lineEnd === -1 ? texto.slice(lineIdx + prefix.length) : texto.slice(lineIdx + prefix.length, lineEnd);
      const item: any = {};
      linea.split('|').forEach(part => {
        const eq = part.indexOf('=');
        if (eq > 0) item[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
      });
      items.push(item);
      i++;
    }
    return items;
  }

  aplicarFiltro() {
    let lista = this.todosLosIngresos();
    const f = this.filter;
    if (this.filterType() === 'numero' && f.numero_oc.trim()) {
      const term = f.numero_oc.trim().toLowerCase();
      lista = lista.filter(ing =>
        (ing.referencia || '').toLowerCase().includes(term) ||
        (ing._orden || '').toLowerCase().includes(term)
      );
    } else if (this.filterType() === 'laboratorio' && f.laboratorio.trim()) {
      const term = f.laboratorio.trim().toLowerCase();
      lista = lista.filter(ing => (ing._laboratorio || '').toLowerCase().includes(term));
    } else if (this.filterType() === 'fecha') {
      if (f.fecha_desde) lista = lista.filter(ing => ing.fecha_ingreso >= f.fecha_desde);
      if (f.fecha_hasta) lista = lista.filter(ing => ing.fecha_ingreso <= f.fecha_hasta);
    }
    this.ingresosFiltrados.set(lista);
  }

  toggleExpandIngreso(id: number, event: Event) {
    event.stopPropagation();
    this.expandedIngreso.set(this.expandedIngreso() === id ? null : id);
  }

  async cargarOrdenes() {
    this.cargandoOrdenes.set(true);
    try {
      const resp: any = await this.api.get<any>('/purchases');
      const lista = Array.isArray(resp) ? resp : (resp?.data ?? []);
      this.todasLasOrdenes.set(lista);
    } catch (err: any) {
      this.error.set(err?.error?.message || 'No se pudieron cargar las órdenes de compra.');
    } finally {
      this.cargandoOrdenes.set(false);
    }
  }

  filtrarOrdenes() {
    const term = this.ocSearch.toLowerCase().trim();
    if (!term) { this.ordenesFiltradas.set([]); return; }
    this.ordenesFiltradas.set(
      this.todasLasOrdenes().filter(o =>
        String(o.numero_oc ?? '').toLowerCase().includes(term) ||
        String(o.proveedor ?? '').toLowerCase().includes(term)
      ).slice(0, 10)
    );
  }

  seleccionarOrden(oc: any) {
    this.ordenSeleccionada.set(oc);
    this.ocSearch = '';
    this.ordenesFiltradas.set([]);
    this.precargarDesdeOrden(oc);
  }

  deseleccionarOrden() {
    this.ordenSeleccionada.set(null);
    this.ocSearch = '';
    this.ordenesFiltradas.set([]);
    this.limpiar();
  }

  activarConOrden() {
    this.modo.set('con_orden');
    this.ordenSeleccionada.set(null);
    this.ocSearch = '';
    this.ordenesFiltradas.set([]);
    this.limpiar();
    this.cargarOrdenes();
  }

  activarSinOrden() {
    this.modo.set('sin_orden');
    this.ordenSeleccionada.set(null);
    this.limpiar();
    this.ocMeta.consecutivo = `ING-SEBAS-${Date.now()}`;
  }

  agregarItem() {
    this.ocItems.push(this.emptyOcItem());
  }

  private async precargarDesdeOrden(oc: any) {
    this.limpiar();
    const obs = String(oc.observaciones ?? '');
    const meta = this.parseObservaciones(obs);

    this.ocMeta = {
      consecutivo: oc.numero_oc ?? '',
      fecha: oc.fecha ? String(oc.fecha).slice(0, 10) : '',
      sede: meta['sede'] || '',
      bodega: meta['bodega'] || '',
      direccion_sede: meta['direccion_sede'] || '',
      ciudad_sede: meta['ciudad'] || '',
      proveedor_nombre: meta['proveedor'] || oc.proveedor || '',
      proveedor_nit: meta['nit'] || '',
      proveedor_contacto: meta['contacto'] || '',
      proveedor_telefono: meta['telefono'] || '',
      proveedor_direccion: meta['direccion_proveedor'] || '',
    };

    const parsedItems: any[] = [];
    let i = 1;
    while (true) {
      const item = this.parseItem(obs, i);
      if (!item) break;
      parsedItems.push({
        codigo: item['codigo'] ?? '',
        nombre: item['nombre'] ?? '',
        laboratorio: item['laboratorio'] ?? '',
        cantidad: Number(item['cantidad']) || 0,
        valor_unitario: Number(item['valor_unitario']) || 0,
        lote: '',
        fecha_vencimiento: '',
      });
      i++;
    }
    this.ocItems = parsedItems.length > 0 ? parsedItems : [this.emptyOcItem()];
    for (const item of this.ocItems) {
      if (item.codigo) await this.autoFillMedFromCodigo(item);
    }
  }

  private parseObservaciones(obs: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const line of obs.split('\n')) {
      const idx = line.indexOf(':');
      if (idx < 1) continue;
      const key = line.slice(0, idx).trim().toLowerCase()
        .replace(/\s+/g, '_').replace(/\//g, '_');
      const value = line.slice(idx + 1).trim();
      if (value) result[key] = value;
    }
    return result;
  }

  private parseItem(obs: string, num: number): Record<string, string> | null {
    const prefix = `Item ${num}:`;
    const line = obs.split('\n').find(l => l.startsWith(prefix));
    if (!line) return null;
    const result: Record<string, string> = {};
    const parts = line.slice(prefix.length).split('|');
    for (const part of parts) {
      const eq = part.indexOf('=');
      if (eq < 1) continue;
      const key = part.slice(0, eq).trim().toLowerCase();
      const val = part.slice(eq + 1).trim();
      result[key] = val;
    }
    return result;
  }

  medFilled(item: any): boolean {
    return item.cumple !== null && item.cumple !== undefined;
  }

  allItemsValidated(): boolean {
    const relevant = this.ocItems.filter(i => (i.codigo || '').trim());
    if (relevant.length === 0) return true;
    return relevant.every(i => i.cumple !== null && i.cumple !== undefined);
  }

  canToggleCumple(item: any): boolean {
    return !!(
      item.registro_invima?.trim() &&
      item.cum?.trim() &&
      item.consecutivo_cum?.trim() &&
      item.presentacion?.trim() &&
      item.temperatura?.trim() &&
      item.iva !== null && item.iva !== undefined && item.iva !== ''
    );
  }

  toggleCumple(item: any) {
    if (!this.canToggleCumple(item)) return;
    item.cumple = item.cumple == null ? true : !item.cumple;
  }

  async autoFillMedFromCodigo(item: any) {
    const codigo = (item.codigo || '').trim();
    if (!codigo) return;
    try {
      const resp: any = await this.api.get<any>(`/products?search=${encodeURIComponent(codigo)}`);
      const lista: any[] = Array.isArray(resp) ? resp : (resp?.data ?? []);
      const found = lista.find((f: any) => f.sku === codigo || f.codigo_control === codigo);
      if (!found) return;

      // nombre y laboratorio vienen del listado (tiene laboratorio_nombre)
      if (!item.nombre && found.nombre_comercial) item.nombre = found.nombre_comercial;
      if (!item.laboratorio && found.laboratorio_nombre) item.laboratorio = found.laboratorio_nombre;

      // campos MX vienen del detalle del producto
      const detResp: any = await this.api.get<any>(`/products/${found.id_producto}`);
      const p: any = detResp?.data ?? detResp;
      if (!item.registro_invima && p.registro_invima) item.registro_invima = p.registro_invima;
      if (!item.cum && p.cum != null) item.cum = String(p.cum);
      if (!item.consecutivo_cum && p.consecutivo_cum != null) item.consecutivo_cum = String(p.consecutivo_cum);
      if (!item.iva && p.iva_tasa != null) item.iva = p.iva_tasa;
      if (!item.temperatura && (p.temp_min != null || p.temp_max != null)) {
        item.temperatura = p.temp_min != null && p.temp_max != null
          ? `${p.temp_min} - ${p.temp_max}°C`
          : p.temp_min != null ? `${p.temp_min}°C` : `${p.temp_max}°C`;
      }
      if (!item.presentacion && p.forma_farmaceutica) item.presentacion = p.forma_farmaceutica;
      // fallback: laboratorio desde detalle si el listado no lo trajo
      if (!item.laboratorio && p.laboratorio?.nombre) item.laboratorio = p.laboratorio.nombre;
      item._showMed = true;
      this.cdr.markForCheck();
    } catch { /* silently ignore — product not found or network error */ }
  }

  itemTotal(item: any): number {
    return (Number(item.cantidad) || 0) * (Number(item.valor_unitario) || 0);
  }

  itemNeto(item: any): number {
    return Math.max(0, this.itemTotal(item) - (Number(item.descuento_valor) || 0));
  }

  onDescuentoPctChange(item: any): void {
    const pct = Math.min(100, Math.max(0, Number(item.descuento_pct) || 0));
    item.descuento_pct = pct;
    item.descuento_valor = +(this.itemTotal(item) * pct / 100).toFixed(2);
  }

  onDescuentoValorChange(item: any): void {
    const subtotal = this.itemTotal(item);
    const val = Math.max(0, Number(item.descuento_valor) || 0);
    item.descuento_valor = val;
    item.descuento_pct = subtotal > 0 ? +(val / subtotal * 100).toFixed(4) : 0;
  }

  grandTotalOc(): number {
    return this.ocItems.reduce((sum, item) => sum + this.itemTotal(item), 0);
  }

  totalDescuentoOc(): number {
    return this.ocItems.reduce((sum, item) => sum + (Number(item.descuento_valor) || 0), 0);
  }

  subtotalNetoOc(): number {
    return this.grandTotalOc() - this.totalDescuentoOc();
  }

  totalIvaOc(): number {
    return this.ocItems.reduce((sum, item) => {
      const rate = Number(item.iva) >= 1 ? Number(item.iva) : 0;
      return sum + (this.itemNeto(item) * rate / 100);
    }, 0);
  }

  totalIngresoOc(): number {
    return this.subtotalNetoOc() + this.totalIvaOc();
  }

  setFilterType(type: 'numero' | 'fecha' | 'laboratorio') {
    this.filterType.set(type);
    this.filter = { numero_oc: '', fecha_desde: '', fecha_hasta: '', laboratorio: '' };
    this.aplicarFiltro();
  }

  clearFilter() {
    this.filter = { numero_oc: '', fecha_desde: '', fecha_hasta: '', laboratorio: '' };
    this.aplicarFiltro();
  }

  async crearIngreso() {
    try {
      this.error.set('');
      this.message.set('');
      if (!this.ocMeta.consecutivo) {
        this.error.set('El consecutivo es obligatorio.');
        return;
      }
      if (!this.ocItems.some(i => Number(i.cantidad) > 0)) {
        this.error.set('Agrega al menos un item con cantidad.');
        return;
      }
      if (!this.allItemsValidated()) {
        this.error.set('Aún falta diligenciar el cumplimiento de algunos medicamentos.');
        return;
      }
      await this.api.post('/ingresos', this.ingresoConOrdenPayload());
      this.message.set('Ingreso Sebas creado exitosamente.');
      this.limpiar();
      this.ordenSeleccionada.set(null);
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible crear el ingreso Sebas.');
    }
  }

  limpiar() {
    this.ingreso = this.emptyIngreso();
    this.factura = this.emptyFactura();
    this.ocMeta = this.emptyOcMeta();
    this.ocItems = [this.emptyOcItem()];
    this.ingresoExtra = this.emptyIngresoExtra();
  }

  private ingresoConOrdenPayload() {
    const items = this.ocItems.filter(i => Number(i.cantidad) > 0);
    const facturaStr = [this.ingresoExtra.prefijo_factura, this.ingresoExtra.numero_factura].filter(Boolean).join('');

    return {
      referencia: [this.ocMeta.consecutivo, facturaStr ? `Factura ${facturaStr}` : ''].filter(Boolean).join(' - '),
      cantidad: items.reduce((sum, i) => sum + Number(i.cantidad), 0),
      lote: items[0]?.lote || null,
      fecha_vencimiento: items[0]?.fecha_vencimiento || null,
      estado: 'recibido',
      // Factura
      prefijo_factura:     this.ingresoExtra.prefijo_factura || null,
      numero_factura:      this.ingresoExtra.numero_factura != null ? String(this.ingresoExtra.numero_factura) : null,
      cufe:                this.ingresoExtra.cufe || null,
      fecha_recepcion:     this.ingresoExtra.fecha_recepcion || null,
      observaciones:       this.ingresoExtra.observaciones || null,
      // Orden / sede
      numero_orden_compra: this.ocMeta.consecutivo || null,
      sede:                this.ocMeta.sede || null,
      bodega:              this.ocMeta.bodega || null,
      // Proveedor
      proveedor_nombre:    this.ocMeta.proveedor_nombre || null,
      proveedor_nit:       this.ocMeta.proveedor_nit || null,
      proveedor_contacto:  this.ocMeta.proveedor_contacto || null,
      proveedor_telefono:  this.ocMeta.proveedor_telefono || null,
      proveedor_direccion: this.ocMeta.proveedor_direccion || null,
      // Totales
      total_bruto:     this.grandTotalOc(),
      total_descuento: this.totalDescuentoOc(),
      subtotal_neto:   this.subtotalNetoOc(),
      total_iva:       this.totalIvaOc(),
      total_ingreso:   this.totalIngresoOc(),
      // Items estructurados
      items: items.map(i => ({
        codigo:          i.codigo || null,
        nombre:          i.nombre || null,
        laboratorio:     i.laboratorio || null,
        cantidad:        Number(i.cantidad) || 0,
        valor_unitario:  Number(i.valor_unitario) || 0,
        descuento_pct:   Number(i.descuento_pct) || 0,
        descuento_valor: Number(i.descuento_valor) || 0,
        iva:             Number(i.iva) || 0,
        lote:            i.lote || null,
        fecha_vencimiento: i.fecha_vencimiento || null,
        registro_invima: i.registro_invima || null,
        cum:             i.cum || null,
        consecutivo_cum: i.consecutivo_cum || null,
        presentacion:    i.presentacion || null,
        temperatura:     i.temperatura || null,
        cumple:          i.cumple ?? null,
      })),
    };
  }


  private emptyOcMeta() {
    return {
      consecutivo: '',
      fecha: '',
      sede: '',
      bodega: '',
      direccion_sede: '',
      ciudad_sede: '',
      proveedor_nombre: '',
      proveedor_nit: '',
      proveedor_contacto: '',
      proveedor_telefono: '',
      proveedor_direccion: '',
    };
  }

  private emptyOcItem() {
    return {
      codigo: '', nombre: '', laboratorio: '', cantidad: 0, valor_unitario: 0,
      lote: '', fecha_vencimiento: '',
      _showMed: false,
      registro_invima: '', cum: '', consecutivo_cum: '',
      presentacion: '', iva: 0, temperatura: '', cumple: null as (boolean | null),
      descuento_pct: 0 as number, descuento_valor: 0 as number,
    };
  }

  private emptyIngresoExtra() {
    return {
      prefijo_factura: '',
      numero_factura: null as number | null,
      cufe: '',
      fecha_recepcion: new Date().toISOString().slice(0, 10),
      observaciones: '',
    };
  }

  private emptyIngreso() {
    return {
      referencia: `ING-SEBAS-${Date.now()}`,
      producto: '',
      cantidad: 1,
      lote: '',
      fecha_vencimiento: '',
      estado: 'pendiente'
    };
  }

  private emptyFactura() {
    return {
      numero_factura: '',
      cufe: '',
      fecha_emision: new Date().toISOString().slice(0, 10),
      fecha_recepcion: new Date().toISOString().slice(0, 10),
      remision: '',
      proveedor_nombre: '',
      proveedor_nit: '',
      proveedor_telefono: '',
      proveedor_direccion: '',
      codigo_producto: '',
      laboratorio: '',
      presentacion: '',
      registro_sanitario: '',
      unidad_medida: 'UN',
      valor_unitario: 0,
      descuento: 0,
      impuesto: 0,
      subtotal: 0,
      total: 0,
      forma_pago: '',
      medio_pago: '',
      observaciones: ''
    };
  }
}
