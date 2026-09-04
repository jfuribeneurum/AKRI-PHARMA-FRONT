import { Component, OnInit, signal, computed, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { SiteContextService } from '../../core/site-context.service';
import { UppercaseInputDirective } from '../../shared/uppercase-input.directive';

@Component({
  selector: 'akri-pharma-ingresos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pharma-ingresos.component.html',
  styleUrls: ['./pharma-ingresos.component.css'],
  imports: [CommonModule, FormsModule, DatePipe, UppercaseInputDirective]
})
export class PharmaIngresosComponent implements OnInit {
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
  readonly actaGenerando = signal<number | null>(null);

  filter = { numero_oc: '', fecha_desde: '', fecha_hasta: '', laboratorio: '' };
  ocSearch = '';

  ocMeta: any = this.emptyOcMeta();
  ocItems: any[] = [this.emptyOcItem()];
  ingresoExtra: any = this.emptyIngresoExtra();

  ingreso: any = this.emptyIngreso();
  factura: any = this.emptyFactura();

  // Bodegas/sedes que esta sesión puede gestionar (mismo grupo por ciudad
  // que Ordenes de Compra) — reemplaza los campos de texto libre de
  // "Datos de la sede" por selectores reales.
  readonly allWarehouses = signal<any[]>([]);
  readonly sedesDisponibles = computed(() => {
    const seen = new Set<number>();
    return this.allWarehouses().filter((wh) => {
      if (seen.has(wh.id_sede)) return false;
      seen.add(wh.id_sede);
      return true;
    });
  });

  readonly allProviders = signal<any[]>([]);

  // Buscador de MX para "Nombre"/"Laboratorio" — mismo mecanismo que en
  // Ordenes de Compra: labProducts trae todos los productos activos
  // (uno por combinación producto+laboratorio), uniqueProducts los agrupa
  // por nombre+concentracion+principio_activo para el desplegable de
  // búsqueda, y labsForProduct() resuelve los laboratorios de esa MX.
  readonly labProducts = signal<any[]>([]);
  readonly uniqueProducts = computed(() => {
    const seen = new Map<string, { key: string; nombre_comercial: string; nombre_medicamento_hs: string | null; concentracion: string; principio_activo: string }>();
    for (const p of this.labProducts()) {
      const key = `${p.nombre_comercial}|${p.concentracion ?? ''}|${p.principio_activo ?? ''}`;
      if (!seen.has(key)) {
        seen.set(key, {
          key,
          nombre_comercial: p.nombre_comercial,
          nombre_medicamento_hs: p.nombre_medicamento_hs ?? null,
          concentracion: p.concentracion,
          principio_activo: p.principio_activo ?? ''
        });
      }
    }
    return Array.from(seen.values());
  });

  labsForProduct(key: string) {
    const [nombre, concentracion, principioActivo] = key.split('|');
    return this.labProducts().filter(
      (p) =>
        p.nombre_comercial === nombre &&
        (p.concentracion ?? '') === concentracion &&
        (p.principio_activo ?? '') === principioActivo
    );
  }

  productoLabel(p: { nombre_medicamento_hs: string | null; nombre_comercial: string; concentracion: string; principio_activo?: string }): string {
    const base = `${p.nombre_medicamento_hs || p.nombre_comercial}${p.concentracion ? ' · ' + p.concentracion : ''}`;
    return p.principio_activo ? `${base} — ${p.principio_activo}` : base;
  }

  readonly mxDropdownOpenIndex = signal<number | null>(null);
  readonly mxDropdownPos = signal<{ top: number; left: number; width: number } | null>(null);

  productosFiltrados(item: any) {
    const q = (item.productoFiltro ?? '').trim().toLowerCase();
    const all = this.uniqueProducts();
    if (!q) return all;
    return all.filter((p) => this.productoLabel(p).toLowerCase().includes(q));
  }

  abrirMxDropdown(index: number, event: FocusEvent) {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    this.mxDropdownPos.set({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    this.mxDropdownOpenIndex.set(index);
  }

  cerrarMxDropdown(item: any) {
    setTimeout(() => {
      this.mxDropdownOpenIndex.set(null);
      const seleccionado = this.uniqueProducts().find((p) => p.key === item.product_key);
      item.productoFiltro = seleccionado ? this.productoLabel(seleccionado) : '';
    }, 150);
  }

  seleccionarProducto(item: any, p: { key: string }) {
    this.onProductKeySelect(item, p.key);
    const sel = this.uniqueProducts().find((x) => x.key === p.key);
    item.productoFiltro = sel ? this.productoLabel(sel) : '';
    this.mxDropdownOpenIndex.set(null);
  }

  onProductKeySelect(item: any, key: string) {
    item.product_key = key;
    item.id_producto = 0;
    item.codigo = '';
    item.nombre = '';
    item.laboratorio = '';

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
    // Mismo criterio que el PDF de la Orden de Compra: nombre_medicamento_hs
    // (el nombre completo vinculado a HealthSphere) por encima del nombre
    // comercial corto — así el listado de Ingresos y el acta de recepción
    // muestran el mismo nombre que ya se ve al generar una OC, en vez del
    // nombre local abreviado (ej. "XULTOPHY" en vez de "SEMAGLUTIDA...").
    const nombreBase = prod.nombre_medicamento_hs || prod.nombre_comercial || '';
    item.nombre = prod.concentracion ? `${nombreBase} ${prod.concentracion}` : nombreBase;
    item.laboratorio = prod.laboratorio_nombre ?? '';
    if (prod.costo_referencia != null) item.valor_unitario = Number(prod.costo_referencia) || item.valor_unitario;
    void this.fillMedDetailsFromProduct(item, prod.id_producto);
  }

  private async fillMedDetailsFromProduct(item: any, idProducto: number) {
    try {
      const detResp: any = await this.api.get<any>(`/products/${idProducto}`);
      const p: any = detResp?.data ?? detResp;
      if (p.registro_invima) item.registro_invima = p.registro_invima;
      if (p.cum != null) item.cum = String(p.cum);
      if (p.consecutivo_cum != null) item.consecutivo_cum = String(p.consecutivo_cum);
      if (p.iva_tasa != null) item.iva = p.iva_tasa;
      if (p.temp_min != null || p.temp_max != null) {
        item.temperatura = p.temp_min != null && p.temp_max != null
          ? `${p.temp_min} - ${p.temp_max}°C`
          : p.temp_min != null ? `${p.temp_min}°C` : `${p.temp_max}°C`;
      } else if (!p.requiere_cadena_frio) {
        // La mayoría del catálogo no tiene temp_min/temp_max cargado en el
        // maestro, pero sí tiene requiere_cadena_frio correctamente en false
        // — para esos (no refrigerados) "Ambiente" es un default seguro.
        // Los que sí requieren cadena de frío se dejan en blanco a propósito:
        // ahí la temperatura real importa clínicamente y debe diligenciarse.
        item.temperatura = 'Ambiente';
      }
      if (p.forma_farmaceutica) item.presentacion = p.forma_farmaceutica;
      this.cdr.markForCheck();
    } catch { /* non-fatal */ }
  }

  private async loadAllProducts() {
    try {
      const res: any = await this.api.get('/products/for-po');
      this.labProducts.set(res?.data ?? []);
    } catch { /* non-fatal */ }
  }

  constructor(
    private readonly api: ApiService,
    private readonly cdr: ChangeDetectorRef,
    private readonly siteContext: SiteContextService
  ) {}

  ngOnInit() {
    this.cargarIngresos();
    this.cargarOrdenes();
    void this.loadWarehouses();
    void this.loadProviders();
    void this.loadAllProducts();
  }

  private async loadWarehouses() {
    try {
      const res: any = await this.api.get('/purchases/warehouses');
      this.allWarehouses.set(res?.data ?? []);
    } catch { /* non-fatal */ }
  }

  private async loadProviders() {
    try {
      const resp: any = await this.api.get('/providers');
      this.allProviders.set(Array.isArray(resp) ? resp : (resp?.data ?? []));
    } catch { /* non-fatal */ }
  }

  onProveedorChange(id: string) {
    const prov = this.allProviders().find((p) => String(p.id_proveedor) === String(id));
    if (!prov) return;
    this.ocMeta.id_proveedor = prov.id_proveedor;
    this.ocMeta.proveedor_nombre = prov.razon_social ?? prov.nombre ?? '';
    this.ocMeta.proveedor_nit = prov.numero_identificacion ?? '';
    this.ocMeta.proveedor_contacto = [prov.nombres, prov.apellidos].filter(Boolean).join(' ');
    this.ocMeta.proveedor_telefono = prov.telefono ?? '';
    this.ocMeta.proveedor_direccion = prov.direccion ?? '';
  }

  bodegasDeSede(idSede: number | null) {
    if (!idSede) return [];
    return this.allWarehouses().filter((wh) => Number(wh.id_sede) === Number(idSede));
  }

  onSedeChange(idSede: string) {
    const wh = this.allWarehouses().find((w) => String(w.id_sede) === String(idSede));
    this.ocMeta.id_sede = wh ? wh.id_sede : null;
    this.ocMeta.id_almacen = wh ? wh.id_almacen : null;
    this.ocMeta.bodega = wh ? wh.nombre : '';
    this.ocMeta.sede = wh ? (wh.sede_nombre ?? '') : '';
    this.ocMeta.direccion_sede = wh ? (wh.sede_direccion ?? '') : '';
    this.ocMeta.ciudad_sede = wh ? (wh.sede_ciudad ?? '') : '';
  }

  onBodegaChange(idAlmacen: string) {
    const wh = this.allWarehouses().find((w) => String(w.id_almacen) === String(idAlmacen));
    if (!wh) return;
    this.ocMeta.id_almacen = wh.id_almacen;
    this.ocMeta.bodega = wh.nombre;
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

  // Acta de recepción técnica: documento formal de verificación de calidad
  // que certifica lo que realmente llegó (lote, vencimiento, registro
  // INVIMA, CUM, condiciones de cadena de frío) contra lo ordenado, con el
  // resultado de cumplimiento por producto. Se arma con los mismos datos que
  // ya se diligencian al crear el ingreso (GET /ingresos/:id trae el
  // encabezado y los items estructurados de ingresos_items) — no se guarda
  // en el servidor, se abre en una pestaña nueva para imprimir/guardar como
  // PDF, igual que el resto de documentos de la app.
  async generarActaRecepcion(ing: any, event?: Event) {
    event?.stopPropagation();
    if (this.actaGenerando() != null) return;
    this.error.set('');
    this.actaGenerando.set(ing.id_ingreso);
    try {
      const res: any = await this.api.get<any>(`/ingresos/${ing.id_ingreso}`);
      const detalle = res?.data ?? res;
      const html = this.buildActaRecepcionHtml(detalle);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'No fue posible generar el acta de recepción técnica.');
    } finally {
      this.actaGenerando.set(null);
    }
  }

  private buildActaRecepcionHtml(ing: any): string {
    const ahora = new Date();
    const horaGeneracion = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
    const fechaGeneracion = ahora.toLocaleDateString('es-CO');
    const fmtFecha = (v: any) => v ? new Date(v).toLocaleDateString('es-CO') : '—';
    const money = (n: any) => Number(n ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const items: any[] = Array.isArray(ing.items) ? ing.items : [];

    const facturaStr = [ing.prefijo_factura, ing.numero_factura].filter(Boolean).join('') || '—';

    const totalItems = items.length;
    const noCumplenCount = items.filter(i => i.cumple === 0 || i.cumple === false).length;

    const resultadoBadge = (it: any) => {
      if (it.cumple === 1 || it.cumple === true) return '<span class="badge badge-ok">CUMPLE</span>';
      if (it.cumple === 0 || it.cumple === false) return '<span class="badge badge-no">NO CUMPLE</span>';
      return '<span class="badge badge-warn">SIN VALIDAR</span>';
    };

    const filasHtml = items.map(it => `
      <tr>
        <td>${it.codigo ?? '—'}</td>
        <td>${it.nombre ?? '—'}</td>
        <td>${it.laboratorio ?? '—'}</td>
        <td>${it.lote ?? '—'}</td>
        <td>${fmtFecha(it.fecha_vencimiento)}</td>
        <td style="text-align:right;">${Number(it.cantidad ?? 0).toFixed(2)}</td>
        <td>${it.registro_invima || '—'}</td>
        <td>${it.cum || '—'}</td>
        <td>${it.consecutivo_cum || '—'}</td>
        <td>${it.presentacion || '—'}</td>
        <td>${it.temperatura || '—'}</td>
        <td style="text-align:center;">${resultadoBadge(it)}</td>
      </tr>
    `).join('');

    const advertenciaNoCumplen = noCumplenCount > 0
      ? `<div class="alerta-no-cumple">⚠ ${noCumplenCount} de ${totalItems} producto(s) fueron marcados como <strong>NO CUMPLE</strong> en la verificación técnica. Deben gestionarse conforme al procedimiento de rechazo, cuarentena o devolución al proveedor antes de su disposición para dispensación o venta.</div>`
      : '';

    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Acta de Recepción Técnica ${ing.referencia ?? ing.id_ingreso}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color:#111827; margin:0; padding:1.5rem; background:#e5e7eb; font-size:0.78rem; }
  .doc { max-width:1050px; margin:0 auto; background:#fff; padding:1.25rem 1.5rem 2rem; box-shadow:0 2px 12px rgba(0,0,0,0.12); }
  .doc-header { position:relative; text-align:center; padding-bottom:0.4rem; border-bottom:3px solid #065f46; margin-bottom:0.75rem; }
  .doc-header .brand { font-weight:800; font-size:0.85rem; color:#065f46; }
  .doc-header .company { font-weight:700; font-size:0.95rem; margin-top:0.4rem; }
  .doc-header .company-line { font-size:0.78rem; }
  .doc-header .doc-title-main { margin:0.5rem 0 0.15rem; font-size:1.05rem; font-weight:800; letter-spacing:0.02em; color:#065f46; }
  .doc-header .doc-subtitle { font-size:0.75rem; color:#4b5563; text-transform:uppercase; letter-spacing:0.03em; }
  .doc-header .header-right { position:absolute; top:0; right:0; text-align:right; font-size:0.75rem; }
  table.info { width:100%; border-collapse:collapse; margin-bottom:0.6rem; }
  table.info th, table.info td { border:1px solid #9ca3af; padding:0.3rem 0.5rem; font-size:0.78rem; text-align:left; }
  table.info th { background:#e5e7eb; font-weight:700; white-space:nowrap; width:1%; }
  .section-title { font-size:0.78rem; font-weight:800; color:#065f46; text-transform:uppercase; letter-spacing:0.03em; margin:0.9rem 0 0.4rem; }
  table.items { width:100%; border-collapse:collapse; margin-top:0.2rem; font-size:0.72rem; }
  table.items th { background:#e5e7eb; border:1px solid #9ca3af; padding:0.3rem 0.35rem; font-weight:700; }
  table.items td { border:1px solid #9ca3af; padding:0.3rem 0.35rem; vertical-align:top; }
  .badge { display:inline-block; padding:0.15rem 0.5rem; border-radius:999px; font-size:0.65rem; font-weight:800; letter-spacing:0.02em; }
  .badge-ok { background:#dcfce7; color:#166534; }
  .badge-no { background:#fee2e2; color:#991b1b; }
  .badge-warn { background:#fef3c7; color:#92400e; }
  .alerta-no-cumple { background:#fee2e2; border:1px solid #fca5a5; color:#991b1b; border-radius:6px; padding:0.6rem 0.85rem; font-size:0.76rem; margin:0.6rem 0; }
  .totales-wrap { display:flex; justify-content:flex-end; margin-top:0.5rem; }
  table.totales { border-collapse:collapse; min-width:300px; }
  table.totales td { border:1px solid #9ca3af; padding:0.3rem 0.6rem; font-size:0.78rem; }
  table.totales td:first-child { background:#e5e7eb; font-weight:700; }
  table.totales td:last-child { text-align:right; }
  table.totales tr.final td { font-weight:800; }
  .obs { margin-top:0.6rem; font-size:0.78rem; color:#374151; white-space:pre-wrap; }
  .certificacion { margin-top:1rem; font-size:0.76rem; color:#1f2937; text-align:justify; background:#f9fafb; border:1px solid #e5e7eb; border-radius:6px; padding:0.75rem 0.9rem; }
  .firmas { display:grid; grid-template-columns:repeat(2, 1fr); gap:2rem; margin-top:3rem; text-align:center; font-size:0.75rem; }
  .firmas .nombre { font-weight:700; min-height:1.1rem; margin-bottom:1.6rem; }
  .firmas .cargo { font-size:0.7rem; color:#4b5563; }
  .firmas .linea { border-top:1px solid #111827; padding-top:0.3rem; }
  .print-bar { max-width:1050px; margin:0 auto 0.75rem; text-align:right; }
  .print-bar button { background:#065f46; color:#fff; border:none; padding:0.5rem 1rem; border-radius:6px; font-size:0.85rem; cursor:pointer; }
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
      <div class="brand">💊 AkriPharmacy — Servicio Farmacéutico</div>
      <div class="company">${ing.sede || '—'}${ing.bodega ? ' · ' + ing.bodega : ''}</div>
      <div class="doc-title-main">ACTA DE RECEPCIÓN TÉCNICA</div>
      <div class="doc-subtitle">Verificación técnica de ingreso de medicamentos y dispositivos médicos</div>
    </div>

    <div class="section-title">Datos generales de la recepción</div>
    <table class="info">
      <tr>
        <th>Acta N° :</th><td>${ing.id_ingreso ?? '—'}</td>
        <th>Referencia :</th><td>${ing.referencia ?? '—'}</td>
      </tr>
      <tr>
        <th>Orden de compra :</th><td>${ing.numero_orden_compra || '—'}</td>
        <th>Fecha de recepción :</th><td>${fmtFecha(ing.fecha_recepcion || ing.fecha_ingreso)}</td>
      </tr>
      <tr>
        <th>Sede :</th><td colspan="3">${ing.sede || '—'}</td>
      </tr>
      <tr>
        <th>N° Factura :</th><td>${facturaStr}</td>
        <th>Fecha factura :</th><td>${fmtFecha(ing.fecha_factura)}</td>
      </tr>
    </table>

    <div class="section-title">Datos del proveedor</div>
    <table class="info">
      <tr><th>Razón social :</th><td colspan="3">${ing.proveedor_nombre || '—'}</td></tr>
      <tr>
        <th>Nit :</th><td colspan="3">${ing.proveedor_nit || '—'}</td>
      </tr>
      <tr>
        <th>Teléfono :</th><td>${ing.proveedor_telefono || '—'}</td>
        <th>Dirección :</th><td>${ing.proveedor_direccion || '—'}</td>
      </tr>
    </table>

    <div class="section-title">Verificación técnica por producto</div>
    ${advertenciaNoCumplen}
    <table class="items">
      <thead>
        <tr>
          <th>Código</th><th>Producto</th><th>Laboratorio</th><th>Lote</th><th>Vencimiento</th>
          <th>Cantidad</th><th>Reg. INVIMA</th><th>CUM</th><th>Consec. CUM</th>
          <th>Presentación</th><th>Temp. cadena de frío</th><th>Resultado</th>
        </tr>
      </thead>
      <tbody>${filasHtml || '<tr><td colspan="12" style="text-align:center;color:#9ca3af;">Sin ítems registrados</td></tr>'}</tbody>
    </table>

    <div class="totales-wrap">
      <table class="totales">
        <tr><td>IVA:</td><td>${money(ing.total_iva)}</td></tr>
        <tr class="final"><td>TOTAL RECIBIDO:</td><td>${money(ing.total_ingreso)}</td></tr>
      </table>
    </div>

    ${ing.observaciones ? `<div class="obs"><strong>Observaciones:</strong><br>${ing.observaciones}</div>` : ''}

    <div class="certificacion">
      El(la) responsable de la verificación técnica certifica que la revisión de los productos relacionados en esta acta
      se realizó cotejando lote, fecha de vencimiento, Registro Sanitario INVIMA, Código Único de Medicamento (CUM) y,
      cuando corresponde, las condiciones de temperatura de cadena de frío, conforme a lo establecido en la Resolución 1403
      de 2007 y demás normatividad vigente aplicable al servicio farmacéutico. Los productos marcados como <strong>NO CUMPLE</strong>
      quedan identificados para su gestión de rechazo, cuarentena o devolución al proveedor, y no deben disponerse para
      dispensación o venta hasta resolver la no conformidad.
    </div>

    <div class="firmas">
      <div>
        <div class="nombre">${ing.creado_por_nombre ?? ''}</div>
        <div class="linea">Verificado y recibido por</div>
        <div class="cargo">Químico Farmacéutico / Regente de Farmacia</div>
      </div>
      <div>
        <div class="nombre">${ing.proveedor_contacto ?? ''}</div>
        <div class="linea">Entregado por (proveedor / transportista)</div>
        <div class="cargo">${ing.proveedor_nombre ?? ''}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
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
    void this.cargarSiguienteConsecutivo();
  }

  private async cargarSiguienteConsecutivo() {
    try {
      const res: any = await this.api.get('/ingresos/next-number');
      this.ocMeta.consecutivo = res?.data?.numero_ingreso ?? '';
    } catch { /* non-fatal */ }
  }

  agregarItem() {
    this.ocItems.push(this.emptyOcItem());
  }

  private async precargarDesdeOrden(oc: any) {
    this.limpiar();
    const obs = String(oc.observaciones ?? '');
    const meta = this.parseObservaciones(obs);

    // La OC solo guarda la sede/bodega como texto libre en observaciones (no
    // un id_almacen real) — intentamos emparejar ese texto con una bodega
    // real de las que esta sesión puede gestionar; si no calza, queda para
    // que el usuario la seleccione a mano.
    const sedeTexto = (meta['sede'] || '').trim().toUpperCase();
    const whMatch = sedeTexto
      ? this.allWarehouses().find((w) => String(w.sede_nombre ?? '').trim().toUpperCase() === sedeTexto)
      : null;

    // La OC sí guarda un id_proveedor real (a diferencia de la sede, que solo
    // queda como texto libre) — se usa directo en vez de intentar emparejar texto.
    const provMatch = oc.id_proveedor
      ? this.allProviders().find((p) => Number(p.id_proveedor) === Number(oc.id_proveedor))
      : null;

    this.ocMeta = {
      consecutivo: oc.numero_oc ?? '',
      fecha: oc.fecha ? String(oc.fecha).slice(0, 10) : '',
      id_sede: whMatch ? whMatch.id_sede : null,
      id_almacen: whMatch ? whMatch.id_almacen : null,
      sede: whMatch ? whMatch.sede_nombre : (meta['sede'] || ''),
      bodega: whMatch ? whMatch.nombre : (meta['bodega'] || ''),
      direccion_sede: whMatch ? (whMatch.sede_direccion ?? '') : (meta['direccion_sede'] || ''),
      ciudad_sede: whMatch ? (whMatch.sede_ciudad ?? '') : (meta['ciudad'] || ''),
      id_proveedor: provMatch ? provMatch.id_proveedor : null,
      proveedor_nombre: provMatch ? (provMatch.razon_social ?? provMatch.nombre ?? '') : (meta['proveedor'] || oc.proveedor || ''),
      proveedor_nit: provMatch ? (provMatch.numero_identificacion ?? '') : (meta['nit'] || ''),
      proveedor_contacto: provMatch ? [provMatch.nombres, provMatch.apellidos].filter(Boolean).join(' ') : (meta['contacto'] || ''),
      proveedor_telefono: provMatch ? (provMatch.telefono ?? '') : (meta['telefono'] || ''),
      proveedor_direccion: provMatch ? (provMatch.direccion ?? '') : (meta['direccion_proveedor'] || ''),
    };

    const parsedItems: any[] = [];
    let i = 1;
    while (true) {
      const item = this.parseItem(obs, i);
      if (!item) break;
      parsedItems.push({
        id_producto: 0, product_key: '', productoFiltro: '',
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

      // Vincula también con el buscador de MX (mismo criterio que la OC) para
      // que la celda "Laboratorio" quede consistente sin importar si el
      // producto se identificó por código o por nombre.
      if (!item.id_producto) {
        item.id_producto = found.id_producto;
        item.product_key = `${found.nombre_comercial}|${found.concentracion ?? ''}|${found.principio_activo ?? ''}`;
        const sel = this.uniqueProducts().find((x) => x.key === item.product_key);
        item.productoFiltro = sel ? this.productoLabel(sel) : (found.nombre_comercial ?? '');
      }

      // campos MX vienen del detalle del producto
      const detResp: any = await this.api.get<any>(`/products/${found.id_producto}`);
      const p: any = detResp?.data ?? detResp;
      if (!item.registro_invima && p.registro_invima) item.registro_invima = p.registro_invima;
      if (!item.cum && p.cum != null) item.cum = String(p.cum);
      if (!item.consecutivo_cum && p.consecutivo_cum != null) item.consecutivo_cum = String(p.consecutivo_cum);
      if (!item.iva && p.iva_tasa != null) item.iva = p.iva_tasa;
      if (!item.temperatura) {
        if (p.temp_min != null || p.temp_max != null) {
          item.temperatura = p.temp_min != null && p.temp_max != null
            ? `${p.temp_min} - ${p.temp_max}°C`
            : p.temp_min != null ? `${p.temp_min}°C` : `${p.temp_max}°C`;
        } else if (!p.requiere_cadena_frio) {
          item.temperatura = 'Ambiente';
        }
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
      this.message.set('Ingreso Pharma creado exitosamente.');
      this.limpiar();
      this.ordenSeleccionada.set(null);
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible crear el ingreso Pharma.');
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
      fecha_factura:       this.ingresoExtra.fecha_factura || null,
      cufe:                this.ingresoExtra.cufe || null,
      fecha_recepcion:     this.ingresoExtra.fecha_recepcion || null,
      observaciones:       this.ingresoExtra.observaciones || null,
      // Orden / sede
      numero_orden_compra: this.ocMeta.consecutivo || null,
      sede:                this.ocMeta.sede || null,
      bodega:              this.ocMeta.bodega || null,
      id_almacen:          this.ocMeta.id_almacen ?? this.siteContext.activeAlmacenId(),
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
      id_sede: null,
      id_almacen: null,
      sede: '',
      bodega: '',
      direccion_sede: '',
      ciudad_sede: '',
      id_proveedor: null,
      proveedor_nombre: '',
      proveedor_nit: '',
      proveedor_contacto: '',
      proveedor_telefono: '',
      proveedor_direccion: '',
    };
  }

  private emptyOcItem() {
    return {
      id_producto: 0, product_key: '', productoFiltro: '',
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
      fecha_factura: '',
      cufe: '',
      fecha_recepcion: new Date().toISOString().slice(0, 10),
      observaciones: '',
    };
  }

  private emptyIngreso() {
    return {
      referencia: `ING-PHARMA-${Date.now()}`,
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
