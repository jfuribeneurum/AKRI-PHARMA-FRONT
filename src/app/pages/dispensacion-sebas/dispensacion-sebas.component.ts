import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { UppercaseInputDirective } from '../../shared/uppercase-input.directive';

interface Formulacion {
  id_formulacion: number;
  idPaciente: number;
  fechaFormulacion: string;
  consecutivo_atencion: number | string | null;
  nombre_paciente: string;
  documento_paciente: string;
  telefono_paciente: string;
  celular_paciente: string;
  total_medicamentos: number;
  control: {
    pendientes: number;
    dispensados: number;
    parciales: number;
    cancelados: number;
    ultima_fecha_dispensacion: string | null;
  } | null;
}

interface MedicamentoFormulacion {
  id_med_formulacion: number;
  idMedicamento: number;
  // id_producto local (Maestro), resuelto en el backend desde
  // productos.id_medicamento_hs. idMedicamento es un id de HealthSphere y
  // NUNCA debe usarse para consultar/descontar inventario local.
  idProductoLocal: number | null;
  nombre_medicamento: string;
  viaAdministracion: string;
  unidadDosificacion: string;
  posologia: number;
  cantidad: number;
  presentacion: string;
  diagnostico: string;
  observaciones: string;
  vigenciaInicio: string | null;
  vigenciaFin: string | null;
  pbs: boolean;
  control: {
    id: number;
    estado: string;
    cantidad_formulada: number;
    cantidad_dispensada: number;
    fecha_dispensacion: string | null;
    observaciones: string | null;
    contrato: string | null;
    regimen: string | null;
  } | null;
}

interface FormulacionDetail extends Formulacion {
  idAtencion: number;
  direccion_paciente: string;
  fecha_nacimiento_paciente: string;
  medicamentos: MedicamentoFormulacion[];
}

interface ModalFormItem {
  med: MedicamentoFormulacion;
  cantidad: number;
  // Arranca en 0 al abrir el modal (no se precarga con el histórico) — solo
  // se usa como override real si el usuario la edita a mano, ver
  // cantidadDispensadaTouched.
  cantidadDispensadaOverride: number;
  // true en cuanto el usuario edita "Cant. dispensada" — distingue "el
  // usuario quiere corregir el acumulado a este valor" de "sigue en su
  // valor inicial sin tocar", para no mandar un override de 0 por accidente
  // solo porque el campo arranca vacío.
  cantidadDispensadaTouched: boolean;
  // Total histórico ya dispensado ANTES de abrir este modal, capturado una
  // sola vez desde el servidor. A diferencia de cantidadDispensadaOverride
  // (editable a mano por el usuario), este nunca cambia durante la sesión del
  // modal — sirve de base fija para getFaltante() sin importar qué escriba
  // el usuario en "Cant. dispensada".
  dispensadaOriginal: number;
  // Lotes elegidos para cubrir "cantidad" (Control de entrega).
  // Clave: `${id_lote}:${id_ubicacion}` — valor: cantidad asignada a esa fila.
  loteSeleccion: Record<string, number>;
}

@Component({
  selector: 'akri-dispensacion-sebas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dispensacion-sebas.component.html',
  styleUrls: ['./dispensacion-sebas.component.css'],
  imports: [CommonModule, FormsModule, UppercaseInputDirective]
})
export class DispensacionSebasComponent implements OnInit {

  formulaciones  = signal<Formulacion[]>([]);
  total          = signal(0);
  page           = signal(1);
  readonly limit = 30;
  loading        = signal(false);
  error          = signal('');

  search       = '';
  filterEstado = '';
  fechaDesde   = '';
  fechaHasta   = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  expandedId     = signal<number | null>(null);
  selectedDetail = signal<FormulacionDetail | null>(null);
  detailLoading  = signal(false);

  showModal       = signal(false);
  modalFormItems  = signal<ModalFormItem[]>([]);
  // Cuando hay varios MX en la formulación, solo se muestran los controles
  // completos del que se está trabajando — los demás quedan colapsados a
  // solo el nombre hasta que se les da click.
  expandedMedId   = signal<number | null>(null);
  modalObs        = '';
  modalContrato   = '';
  modalRegimen    = '';
  modalSaving     = signal(false);
  modalError      = signal('');
  modalSuccess    = signal('');
  showSoporteConfirm = signal(false);
  private soporteData: any = null;

  showHistorial   = signal(false);
  historial       = signal<any[]>([]);
  historialLoading = signal(false);
  historialAnulando = signal<number | null>(null);
  entregaAAnular    = signal<any | null>(null);

  showSoportesList    = signal(false);
  soportesListLoading = signal(false);
  soportesListGrupos  = signal<{ fecha: Date; items: any[] }[]>([]);
  soportesListDetail  = signal<FormulacionDetail | null>(null);

  contratoOptions: { valor: string; etiqueta: string }[] = [];
  regimenOptions: { valor: string; etiqueta: string }[] = [];

  readonly stockByMed   = signal<Record<number, any[]>>({});
  readonly stockLoading = signal<Set<number>>(new Set());

  get totalPages(): number { return Math.max(1, Math.ceil(this.total() / this.limit)); }

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.cargarParametrosDispensacion();
  }

  hasActiveFilter(): boolean {
    return !!(this.search.trim() || this.filterEstado || this.fechaDesde || this.fechaHasta);
  }

  private async cargarParametrosDispensacion() {
    try {
      const [contrato, regimen] = await Promise.all([
        this.api.get<{ success: boolean; data: { valor: string; etiqueta: string }[] }>('/parametros/contrato/activos'),
        this.api.get<{ success: boolean; data: { valor: string; etiqueta: string }[] }>('/parametros/regimen_paciente/activos')
      ]);
      this.contratoOptions = contrato.data ?? [];
      this.regimenOptions = regimen.data ?? [];
    } catch { /* non-fatal */ }
  }

  async load() {
    if (!this.hasActiveFilter()) {
      this.formulaciones.set([]);
      this.total.set(0);
      this.error.set('');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    try {
      const params = new URLSearchParams({
        search: this.search,
        page:   String(this.page()),
        limit:  String(this.limit)
      });
      if (this.filterEstado) params.set('estado', this.filterEstado);
      if (this.fechaDesde)   params.set('fechaDesde', this.fechaDesde);
      if (this.fechaHasta)   params.set('fechaHasta', this.fechaHasta);

      const res = await this.api.get<any>(`/formulaciones-hs?${params}`);
      this.formulaciones.set(res.data ?? []);
      this.total.set(res.total ?? 0);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Error al cargar formulaciones');
    } finally {
      this.loading.set(false);
    }
  }

  resetAndLoad() {
    this.page.set(1);
    this.expandedId.set(null);
    this.selectedDetail.set(null);
    this.load();
  }

  onSearchChange() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.resetAndLoad(), 400);
  }

  clearFilters() {
    this.search       = '';
    this.filterEstado = '';
    this.fechaDesde   = '';
    this.fechaHasta   = '';
    this.resetAndLoad();
  }

  goPage(p: number) {
    this.page.set(p);
    this.expandedId.set(null);
    this.selectedDetail.set(null);
    this.load();
  }

  toggleExpand(id: number) {
    if (this.expandedId() === id) {
      this.expandedId.set(null);
      this.selectedDetail.set(null);
      return;
    }
    this.expandedId.set(id);
    this.loadDetail(id);
  }

  async loadDetail(id: number) {
    this.detailLoading.set(true);
    this.selectedDetail.set(null);
    try {
      const res = await this.api.get<any>(`/formulaciones-hs/${id}`);
      this.selectedDetail.set(res.data);
    } catch {
      // error silencioso
    } finally {
      this.detailLoading.set(false);
    }
  }

  // Valor inicial (servidor) de lo pendiente, usado solo para sembrar el
  // formulario al abrir el modal — dentro del modal usar getPendiente(item),
  // que reacciona en vivo si el usuario corrige "Cant. dispensada".
  getMedRestante(med: MedicamentoFormulacion): number {
    return Math.max(0, (med.cantidad ?? 0) - (med.control?.cantidad_dispensada ?? 0));
  }

  // Pendiente = Control de entrega - Cant. dispensada (histórico acumulado,
  // editable en vivo en el modal vía cantidadDispensadaOverride).
  getPendiente(item: ModalFormItem): number {
    return Math.max(0, Number(item.cantidad || 0) - Number(item.cantidadDispensadaOverride || 0));
  }

  // Si aún queda cantidad formulada sin dispensar en el histórico. No
  // confundir con getPendiente() (lo que muestra la casilla "Cant.
  // Pendiente", que compara contra "Control de entrega") — este es el que
  // decide si el medicamento sigue siendo elegible para guardarse y si debe
  // mostrarse como "✅ Completado" (usado también por la plantilla).
  tienePendientePorFormular(item: ModalFormItem): boolean {
    return Math.max(0, (item.med.cantidad ?? 0) - Number(item.cantidadDispensadaOverride || 0)) > 0;
  }

  // Faltante = cantidad formulada - total histórico ya entregado (fijo, de
  // rondas anteriores) - Control de entrega (esta acción). Se usa
  // dispensadaOriginal (inmutable) y no cantidadDispensadaOverride (editable)
  // para que escribir en "Cant. dispensada" nunca descuente dos veces la
  // misma entrega.
  getFaltante(item: ModalFormItem): number {
    return Math.max(0, (item.med.cantidad ?? 0) - item.dispensadaOriginal - Number(item.cantidad || 0));
  }

  // "Cant. dispensada" es 100% manual: nunca se autocompleta. Solo cuando el
  // usuario escribe aquí a propósito se marca cantidadDispensadaTouched, para
  // que saveDispensacion() la mande como override real — si nunca la toca,
  // el backend sigue sumando el acumulado normalmente (sin riesgo).
  setDispensadaOverride(item: ModalFormItem, value: number) {
    this.modalFormItems.update(items => items.map(i =>
      i !== item ? i : { ...i, cantidadDispensadaOverride: Number(value) || 0, cantidadDispensadaTouched: true }
    ));
  }

  // "Control de entrega" solo actualiza cuánto se va a entregar en esta
  // acción — a propósito no toca "Cant. dispensada" para nada (es un campo
  // aparte, de edición libre y manual del usuario).
  updateControlDeEntrega(item: ModalFormItem, value: number) {
    const max = this.getMedEntregaMax(item.med);
    const cantidad = Math.max(0, Math.min(max, Math.floor(Number(value) || 0)));
    this.modalFormItems.update(items => items.map(i =>
      i !== item ? i : { ...i, cantidad }
    ));
  }

  isMedExpanded(item: ModalFormItem): boolean {
    return this.expandedMedId() === item.med.id_med_formulacion;
  }

  toggleMedCard(item: ModalFormItem) {
    this.expandedMedId.set(this.isMedExpanded(item) ? null : item.med.id_med_formulacion);
  }

  getMedEntregaMax(med: MedicamentoFormulacion): number {
    const pendiente = this.getMedRestante(med);
    const stock = med.idProductoLocal ? this.getMedStockTotal(med.idProductoLocal) : 0;
    return Math.min(pendiente, stock);
  }

  // Clave estable para identificar una fila de stock (un mismo lote puede
  // tener existencias en más de un almacén/ubicación).
  loteKey(lot: any): string {
    return `${lot.id_lote}:${lot.id_ubicacion}`;
  }

  // Número de lote legible para el soporte de entrega, a partir del stock
  // ya cargado en el modal (el payload que se envía solo trae los ids).
  private loteNumero(item: ModalFormItem, idLote: number, idUbicacion: number): string {
    const stock = item.med.idProductoLocal ? this.getMedStock(item.med.idProductoLocal) : [];
    const lote = stock.find(l => l.id_lote === idLote && l.id_ubicacion === idUbicacion);
    return lote?.numero_lote ?? `#${idLote}`;
  }

  getAsignado(item: ModalFormItem): number {
    return Object.values(item.loteSeleccion).reduce((s, v) => s + Number(v || 0), 0);
  }

  getAsignadoValido(item: ModalFormItem): boolean {
    return this.getAsignado(item) === Number(item.cantidad || 0);
  }

  // Ajusta la cantidad de un lote ya marcado. A diferencia de toggleLote(),
  // nunca lo desmarca al llegar a 0 — para eso está el checkbox — así el
  // usuario puede seguir repartiendo entre los lotes marcados sin que el
  // campo desaparezca a mitad de la edición.
  setLoteQty(item: ModalFormItem, lot: any, value: number) {
    const max = Number(lot.cantidad_disponible ?? 0);
    const cantidad = Math.max(0, Math.min(max, Math.floor(Number(value) || 0)));
    const key = this.loteKey(lot);
    this.modalFormItems.update(items => items.map(i => {
      if (i !== item) return i;
      return { ...i, loteSeleccion: { ...i.loteSeleccion, [key]: cantidad } };
    }));
  }

  // "Marcado" es si el lote está seleccionado, independiente de si ya se le
  // asignó cantidad (un lote recién marcado puede arrancar en 0 si ya no
  // queda nada por repartir, para poder ajustarlo a mano).
  isLoteChecked(item: ModalFormItem, lot: any): boolean {
    return this.loteKey(lot) in item.loteSeleccion;
  }

  getLotesMarcados(item: ModalFormItem): number {
    return Object.keys(item.loteSeleccion).length;
  }

  // Al marcar un lote se le asigna automáticamente lo que aún falte por cubrir
  // (sin exceder su disponible), para que no haya que escribir el número a mano
  // salvo que ese lote no alcance solo o se combinen varios lotes.
  toggleLote(item: ModalFormItem, lot: any, checked: boolean) {
    const key = this.loteKey(lot);
    this.modalFormItems.update(items => items.map(i => {
      if (i !== item) return i;
      const loteSeleccion = { ...i.loteSeleccion };
      if (!checked) {
        delete loteSeleccion[key];
        return { ...i, loteSeleccion };
      }
      const asignadoOtros = Object.entries(loteSeleccion)
        .reduce((s, [k, v]) => s + (k === key ? 0 : Number(v || 0)), 0);
      const restante = Math.max(0, Number(i.cantidad || 0) - asignadoOtros);
      const disponible = Number(lot.cantidad_disponible ?? 0);
      loteSeleccion[key] = Math.min(restante, disponible);
      return { ...i, loteSeleccion };
    }));
  }

  hasItemsToDispense(): boolean {
    if (!this.modalContrato || !this.modalRegimen) return false;
    const items = this.modalFormItems();
    if (items.some(i => !i.med.idProductoLocal)) return false;
    const pendingItems = items.filter(i => this.tienePendientePorFormular(i));
    if (!pendingItems.length) return false;
    const anyPendingWithNoStock = pendingItems.some(i =>
      !this.stockLoading().has(i.med.idProductoLocal!) &&
      this.getMedStockTotal(i.med.idProductoLocal!) === 0
    );
    if (anyPendingWithNoStock) return false;
    return pendingItems.some(i => i.cantidad > 0 && this.getAsignadoValido(i));
  }

  getMedStock(idProductoLocal: number): any[] {
    return this.stockByMed()[idProductoLocal] ?? [];
  }

  getMedStockTotal(idProductoLocal: number): number {
    return this.getMedStock(idProductoLocal).reduce((s, l) => s + Number(l.cantidad_disponible ?? 0), 0);
  }

  private async loadStockForMed(idProductoLocal: number) {
    if (!idProductoLocal) return;
    this.stockLoading.update(s => new Set([...s, idProductoLocal]));
    try {
      const res = await this.api.get<any>(`/inventory/stock/product/${idProductoLocal}`);
      const lots = Array.isArray(res) ? res : (res?.data ?? []);
      this.stockByMed.update(m => ({ ...m, [idProductoLocal]: lots }));
      // El stock llega después de fijar la cantidad inicial (= pendiente);
      // si hay menos stock que pendiente, hay que bajar la cantidad a entregar.
      this.modalFormItems.update(items => items.map(item => {
        if (item.med.idProductoLocal !== idProductoLocal) return item;
        const entregaMax = this.getMedEntregaMax(item.med);
        return entregaMax > 0 ? { ...item, cantidad: Math.min(item.cantidad, entregaMax) } : item;
      }));
    } catch {
      this.stockByMed.update(m => ({ ...m, [idProductoLocal]: [] }));
    } finally {
      this.stockLoading.update(s => { const n = new Set(s); n.delete(idProductoLocal); return n; });
    }
  }

  async abrirHistorial() {
    const detail = this.selectedDetail();
    if (!detail) return;
    this.showHistorial.set(true);
    this.historialLoading.set(true);
    this.historial.set([]);
    try {
      const res = await this.api.get<any>(`/dispensacion-hs/formulacion/${detail.id_formulacion}/historial`);
      this.historial.set(Array.isArray(res) ? res : (res?.data ?? []));
    } catch {
      this.historial.set([]);
    } finally {
      this.historialLoading.set(false);
    }
  }

  cerrarHistorial() {
    this.showHistorial.set(false);
  }

  // Anula una entrega puntual del histórico: repone el inventario que había
  // salido y la cantidad vuelve a sumarse a lo pendiente por entregar. Queda
  // trazabilidad en BD del usuario que anuló (recordProcessTrace, backend).
  // Se pide confirmación con el mismo estilo de modal que el resto de la
  // app (en vez del confirm() nativo del navegador, poco amigable).
  pedirAnulacion(h: any) {
    if (this.historialAnulando() != null) return;
    this.entregaAAnular.set(h);
  }

  cancelarAnulacion() {
    this.entregaAAnular.set(null);
  }

  async confirmarAnulacion() {
    const h = this.entregaAAnular();
    if (!h) return;
    this.entregaAAnular.set(null);

    this.historialAnulando.set(h.id_movimiento);
    try {
      await this.api.post(`/dispensacion-hs/movimiento/${h.id_movimiento}/anular`, {});
      await this.abrirHistorial();
      const detail = this.selectedDetail();
      if (detail) await this.loadDetail(detail.id_formulacion);
    } catch (error: any) {
      this.error.set(error?.error?.message ?? 'No fue posible anular esta entrega.');
    } finally {
      this.historialAnulando.set(null);
    }
  }

  // PDF consolidado con TODO el histórico de entregas de la formulación en un
  // solo documento (a diferencia de "Soportes de entrega", que abre un PDF
  // individual por cada acción de guardado). Diseño con acento distinto
  // (teal) para que no se confunda visualmente con el soporte de entrega.
  generarPdfHistorialGeneral() {
    const detail = this.selectedDetail();
    if (!detail) return;
    const html = this.buildHistorialGeneralHtml(detail, this.historial());
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  private buildHistorialGeneralHtml(detail: FormulacionDetail, filas: any[]): string {
    const impresionStr = new Date().toLocaleDateString('es-CO') + ' ' + new Date().toLocaleTimeString('es-CO');
    const totalUnidades = filas.reduce((s, f) => s + Number(f.cantidad || 0), 0);
    const codigo = `HG-${detail.id_formulacion}-${Date.now()}`;

    const filasHtml = filas.map(f => `
      <tr>
        <td>${new Date(f.fecha_hora).toLocaleDateString('es-CO')} ${new Date(f.fecha_hora).toLocaleTimeString('es-CO')}</td>
        <td>${f.nombre_medicamento ?? '—'}</td>
        <td>${f.numero_lote ?? '—'}</td>
        <td>${f.almacen ?? '—'}</td>
        <td style="text-align:center; font-weight:700;">${f.cantidad ?? 0}</td>
        <td>${f.usuario ?? '—'}</td>
      </tr>
    `).join('');

    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Reporte General de Histórico - ${codigo}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color:#1e293b; margin:0; padding:2rem; background:#f8fafc; }
  .doc { max-width:900px; margin:0 auto; background:#fff; border-radius:4px; box-shadow:0 4px 24px rgba(0,0,0,0.08); overflow:hidden; }
  .doc-header { display:flex; justify-content:space-between; align-items:flex-start; padding:1.25rem 2rem; border-bottom:3px solid #0d9488; background:#f0fdfa; }
  .doc-header .brand { font-size:1.15rem; font-weight:800; color:#0d9488; }
  .doc-header .brand small { display:block; font-weight:400; font-size:0.72rem; color:#64748b; margin-top:2px; }
  .doc-header .meta { text-align:right; font-size:0.75rem; color:#64748b; }
  .doc-title { text-align:center; padding:1rem 2rem 0.4rem; }
  .doc-title h1 { margin:0; font-size:1.1rem; letter-spacing:0.05em; text-transform:uppercase; color:#0d9488; }
  .doc-title span { font-size:0.75rem; color:#94a3b8; text-transform:uppercase; letter-spacing:0.04em; }
  .doc-body { padding:1rem 2rem 1.5rem; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:0.6rem 2rem; margin-bottom:1rem; padding-bottom:1rem; border-bottom:1px solid #e2e8f0; }
  .field { font-size:0.85rem; }
  .field span { display:block; color:#94a3b8; font-size:0.72rem; text-transform:uppercase; letter-spacing:0.03em; }
  .field strong { font-size:0.95rem; }
  .resumen { display:flex; gap:1.5rem; margin-bottom:1rem; }
  .resumen .box { background:#f0fdfa; border:1px solid #99f6e4; border-radius:8px; padding:0.6rem 1rem; text-align:center; }
  .resumen .box strong { display:block; font-size:1.2rem; color:#0d9488; }
  .resumen .box span { font-size:0.7rem; color:#64748b; text-transform:uppercase; }
  table { width:100%; border-collapse:collapse; margin-top:0.5rem; font-size:0.82rem; }
  th { background:#f0fdfa; text-align:left; padding:0.5rem 0.6rem; color:#0d9488; font-size:0.72rem; text-transform:uppercase; }
  td { padding:0.5rem 0.6rem; border-bottom:1px solid #e2e8f0; }
  tr:nth-child(even) td { background:#f8fafc; }
  .footer { padding:1rem 2rem; font-size:0.7rem; color:#94a3b8; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; }
  .print-bar { max-width:900px; margin:0 auto 1rem; text-align:right; }
  .print-bar button { background:#0d9488; color:#fff; border:none; padding:0.5rem 1rem; border-radius:8px; font-size:0.85rem; cursor:pointer; }
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
      <div class="brand">💊 AkriPharmacy<small>Sistema de gestión farmacéutica</small></div>
      <div class="meta">Fecha de impresión<br><strong>${impresionStr}</strong></div>
    </div>
    <div class="doc-title">
      <span>Reporte consolidado</span>
      <h1>Histórico General de Entregas</h1>
    </div>
    <div class="doc-body">
      <div class="grid">
        <div class="field"><span>Paciente</span><strong>${detail.nombre_paciente}</strong></div>
        <div class="field"><span>Documento</span><strong>${detail.documento_paciente}</strong></div>
      </div>
      <div class="resumen">
        <div class="box"><strong>${filas.length}</strong><span>Movimientos</span></div>
        <div class="box"><strong>${totalUnidades}</strong><span>Unidades entregadas</span></div>
      </div>
      <table>
        <thead><tr><th>Fecha</th><th>Medicamento</th><th>Lote</th><th>Almacén</th><th>Cantidad</th><th>Usuario</th></tr></thead>
        <tbody>${filasHtml}</tbody>
      </table>
    </div>
    <div class="footer">
      <span>AkriPharmacy — Documento generado automáticamente por el sistema</span>
      <span>${codigo}</span>
    </div>
  </div>
</body>
</html>`;
  }

  // Siempre recarga el detalle desde el servidor antes de sembrar el modal:
  // selectedDetail() puede estar desactualizado si el usuario dispensa varias
  // rondas seguidas antes de que termine el refresco automático de la ronda
  // anterior, y sembrar con un total histórico viejo hace que "Cant.
  // Faltante" calcule mal.
  //
  // dispensadaOriginal NO se toma de dispensacion_hs_control.cantidad_dispensada
  // (ese campo se puede desincronizar si alguien manda un override manual
  // equivocado en "Cant. dispensada") — se calcula sumando el histórico real
  // de movimientos_inventario, que es el registro append-only de lo que
  // físicamente salió del inventario. Así "Cant. Faltante" es siempre
  // correcto sin importar qué le pase al acumulado cacheado.
  async openFormulacionModal() {
    const current = this.selectedDetail();
    if (!current) return;
    await this.loadDetail(current.id_formulacion);
    const detail = this.selectedDetail();
    if (!detail) return;

    const entregadoReal: Record<number, number> = {};
    try {
      const histRes = await this.api.get<any>(`/dispensacion-hs/formulacion/${detail.id_formulacion}/historial`);
      const rows = Array.isArray(histRes) ? histRes : (histRes?.data ?? []);
      for (const r of rows) {
        if (r.id_med_formulacion_hs == null) continue;
        entregadoReal[r.id_med_formulacion_hs] = (entregadoReal[r.id_med_formulacion_hs] ?? 0) + Number(r.cantidad || 0);
      }
    } catch { /* si falla, se usa el acumulado cacheado como respaldo */ }

    const items: ModalFormItem[] = detail.medicamentos
      .filter(m => m.control?.estado !== 'cancelado')
      .map(m => ({
        med: m,
        cantidad: 0,
        cantidadDispensadaOverride: 0,
        cantidadDispensadaTouched: false,
        dispensadaOriginal: entregadoReal[m.id_med_formulacion] ?? m.control?.cantidad_dispensada ?? 0,
        loteSeleccion: {}
      }));

    this.modalFormItems.set(items);
    this.expandedMedId.set(items[0]?.med.id_med_formulacion ?? null);
    this.modalObs = '';
    this.modalContrato = '';
    this.modalRegimen = '';
    this.modalError.set('');
    this.modalSuccess.set('');
    this.stockByMed.set({});
    this.showModal.set(true);

    for (const item of items) {
      if (item.med.idProductoLocal) this.loadStockForMed(item.med.idProductoLocal);
    }
  }

  closeModal() {
    if (this.modalSaving()) return;
    this.showModal.set(false);
    this.showSoporteConfirm.set(false);
    this.soporteData = null;
    this.modalFormItems.set([]);
  }

  async saveDispensacion() {
    const detail = this.selectedDetail();
    if (!detail) return;

    if (!this.modalContrato || !this.modalRegimen) {
      this.modalError.set('Debes seleccionar el contrato y el régimen antes de confirmar la dispensación.');
      return;
    }

    const toSave = this.modalFormItems().filter(
      i => !!i.med.idProductoLocal && this.tienePendientePorFormular(i) && Number(i.cantidad) > 0
    );
    if (!toSave.length) {
      this.modalError.set('No hay medicamentos pendientes por dispensar.');
      return;
    }
    if (toSave.some(i => !this.getAsignadoValido(i))) {
      this.modalError.set('Debes asignar lotes por el total de "Control de entrega" en cada medicamento.');
      return;
    }

    this.modalSaving.set(true);
    this.modalError.set('');
    this.modalSuccess.set('');
    try {
      const soporteItems: any[] = [];
      // Si esta entrega deja algo pendiente por primera vez (el medicamento
      // no tenía nada dispensado antes), va en la página "Pendiente". Si en
      // cambio esta entrega está resolviendo/continuando un pendiente que ya
      // existía de una visita anterior, va en "Dispensación pendiente".
      const pendientesNuevos: any[] = [];
      const pendientesContinuados: any[] = [];
      for (const item of toSave) {
        const dispensadaOriginal = item.dispensadaOriginal;
        // Solo se manda como override si el usuario escribió algo a mano en
        // "Cant. dispensada" (cantidadDispensadaTouched). Si nunca la toca,
        // no se manda override y el backend suma normalmente al acumulado.
        const overrideManual = item.cantidadDispensadaTouched
          ? Number(item.cantidadDispensadaOverride)
          : null;
        const lotes = Object.entries(item.loteSeleccion)
          .filter(([, cantidad]) => Number(cantidad) > 0)
          .map(([key, cantidad]) => {
            const [id_lote, id_ubicacion] = key.split(':').map(Number);
            return { id_lote, id_ubicacion, cantidad };
          });
        const res = await this.api.post<{ success: boolean; data: any }>('/dispensacion-hs', {
          id_formulacion_hs:                  detail.id_formulacion,
          id_med_formulacion_hs:              item.med.id_med_formulacion,
          cantidad_dispensada:                Number(item.cantidad),
          lotes,
          cantidad_dispensada_total_override: overrideManual,
          cantidad_pendiente_antes:           this.getPendiente(item),
          cantidad_faltante:                  this.getFaltante(item),
          observaciones:                      this.modalObs || null,
          contrato:                           this.modalContrato || null,
          regimen:                            this.modalRegimen || null
        });
        const nuevoTotal = Number(res?.data?.cantidad_dispensada ?? item.cantidad);
        const pendienteFinal = Math.max(0, Number(item.med.cantidad ?? 0) - nuevoTotal);
        for (const l of lotes) {
          soporteItems.push({
            nombre_medicamento: item.med.nombre_medicamento,
            numero_lote: this.loteNumero(item, l.id_lote, l.id_ubicacion),
            cantidad_dispensada: l.cantidad,
            cantidad_pendiente: pendienteFinal
          });
        }
        if (pendienteFinal > 0) {
          const resumenPendiente = {
            nombre_medicamento: item.med.nombre_medicamento,
            cantidad_dispensada: Number(item.cantidad),
            cantidad_pendiente: pendienteFinal
          };
          if (dispensadaOriginal === 0) pendientesNuevos.push(resumenPendiente);
          else pendientesContinuados.push(resumenPendiente);
        } else if (dispensadaOriginal > 0) {
          // Se terminó de pagar un pendiente anterior: igual documenta esta
          // entrega en la página de "Dispensación pendiente" (con 0 restante).
          pendientesContinuados.push({
            nombre_medicamento: item.med.nombre_medicamento,
            cantidad_dispensada: Number(item.cantidad),
            cantidad_pendiente: 0
          });
        }
      }
      this.modalSuccess.set(`Dispensación registrada (${toSave.length} medicamento${toSave.length > 1 ? 's' : ''}).`);
      this.soporteData = {
        detail,
        pendientesNuevos,
        pendientesContinuados,
        items: soporteItems,
        contrato: this.modalContrato,
        regimen: this.modalRegimen,
        observaciones: this.modalObs,
        fecha: new Date()
      };
      this.showSoporteConfirm.set(true);
    } catch (err: any) {
      this.modalError.set(err?.error?.message ?? 'Error al registrar la dispensación');
    } finally {
      this.modalSaving.set(false);
    }
  }

  // Lista, en un modal, cada entrega real ya realizada (una por acción de
  // guardado, agrupando los lotes que comparten la misma fecha_hora), para
  // poder abrir/regenerar el PDF de cualquiera de ellas puntualmente.
  async abrirSoportesLista(f: Formulacion) {
    this.error.set('');
    this.showSoportesList.set(true);
    this.soportesListLoading.set(true);
    this.soportesListGrupos.set([]);
    this.soportesListDetail.set(null);
    try {
      const [detailRes, histRes] = await Promise.all([
        this.api.get<any>(`/formulaciones-hs/${f.id_formulacion}`),
        this.api.get<any>(`/dispensacion-hs/formulacion/${f.id_formulacion}/historial`)
      ]);
      this.soportesListDetail.set(detailRes.data);
      const rows = Array.isArray(histRes) ? histRes : (histRes?.data ?? []);

      // Los lotes de UNA sola acción de guardado no siempre comparten el
      // mismo fecha_hora exacto: si el guardado inserta varios lotes en el
      // mismo clic, cada INSERT toma su propio NOW() y puede caer un segundo
      // después del anterior (confirmado con datos reales). Agrupar por
      // igualdad estricta de timestamp separaba una sola entrega en varias
      // "soportes" — en vez de eso, se agrupan movimientos consecutivos que
      // caen dentro de una ventana corta (2s) como una misma acción.
      const UMBRAL_MS = 2000;
      const ordenAsc = [...rows].sort(
        (a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime()
      );
      const grupos: { fecha: Date; items: any[] }[] = [];
      for (const r of ordenAsc) {
        const t = new Date(r.fecha_hora).getTime();
        const actual = grupos[grupos.length - 1];
        const ultimoT = actual ? new Date(actual.items[actual.items.length - 1].fecha_hora).getTime() : null;
        if (actual && ultimoT !== null && t - ultimoT <= UMBRAL_MS) {
          actual.items.push(r);
        } else {
          grupos.push({ fecha: new Date(r.fecha_hora), items: [r] });
        }
      }
      grupos.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
      this.soportesListGrupos.set(grupos);
    } catch {
      this.soportesListGrupos.set([]);
    } finally {
      this.soportesListLoading.set(false);
    }
  }

  cerrarSoportesLista() {
    this.showSoportesList.set(false);
  }

  // PDF consolidado con TODAS las entregas (todos los soportes) de la
  // formulación en un solo documento, en vez de tener que abrir cada uno por
  // separado. Usa el mismo diseño que los soportes individuales — misma
  // tabla y estilo, solo que con una columna de fecha y todas las filas
  // juntas — para que se vea igual, no como un reporte aparte.
  generarPdfSoportesGeneral() {
    const detail = this.soportesListDetail();
    if (!detail) return;

    const cronologico = [...this.soportesListGrupos()].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    const formuladaPorMed = Object.fromEntries(detail.medicamentos.map(m => [m.nombre_medicamento, Number(m.cantidad ?? 0)]));
    const acumulado: Record<string, number> = {};
    const items: any[] = [];
    const usuarios = new Set<string>();
    for (const g of cronologico) {
      for (const it of g.items) {
        const nombre = it.nombre_medicamento;
        acumulado[nombre] = (acumulado[nombre] ?? 0) + Number(it.cantidad);
        if (it.usuario) usuarios.add(it.usuario);
        items.push({
          fechaStr: `${g.fecha.toLocaleDateString('es-CO')} ${g.fecha.toLocaleTimeString('es-CO')}`,
          nombre_medicamento: nombre,
          numero_lote: it.numero_lote,
          cantidad_dispensada: it.cantidad,
          cantidad_pendiente: Math.max(0, (formuladaPorMed[nombre] ?? 0) - acumulado[nombre])
        });
      }
    }
    items.reverse(); // más reciente primero, igual que la lista en pantalla

    // Contrato/Régimen/Usuario pueden variar entre entregas — se muestra el
    // valor si todas coinciden, o "Varios" cuando difieren.
    const unico = (vals: (string | null | undefined)[]): string => {
      const distintos = [...new Set(vals.filter(v => !!v))];
      if (distintos.length === 0) return '—';
      if (distintos.length === 1) return distintos[0]!;
      return 'Varios';
    };
    const contratosMed = detail.medicamentos.map(m => m.control?.contrato ? this.getEtiqueta(this.contratoOptions, m.control.contrato) : null);
    const regimenesMed = detail.medicamentos.map(m => m.control?.regimen ? this.getEtiqueta(this.regimenOptions, m.control.regimen) : null);
    const contratoGeneral = unico(contratosMed);
    const regimenGeneral = unico(regimenesMed);
    const dispensadoPorGeneral = unico([...usuarios]);
    const periodoGeneral = cronologico.length
      ? `${cronologico[0].fecha.toLocaleDateString('es-CO')} — ${cronologico[cronologico.length - 1].fecha.toLocaleDateString('es-CO')}`
      : '—';

    // Estado final de pendientes: por cada medicamento, lo acumulado en TODAS
    // las entregas de esta lista vs. lo formulado — no por acción individual.
    const pendientesFinal = Object.keys(acumulado)
      .map(nombre => ({
        nombre_medicamento: nombre,
        cantidad_dispensada: acumulado[nombre],
        cantidad_pendiente: Math.max(0, (formuladaPorMed[nombre] ?? 0) - acumulado[nombre])
      }))
      .filter(p => p.cantidad_pendiente > 0);

    this.generarSoporteEntrega({
      detail,
      items,
      esGeneral: true,
      pendientesFinal,
      contratoGeneral,
      regimenGeneral,
      dispensadoPorGeneral,
      periodoGeneral,
      contrato: null,
      regimen: null,
      observaciones: null,
      fecha: new Date()
    });
  }

  // Reconstruye el soporte de esa entrega puntual a partir del histórico real
  // (movimientos_inventario), incluyendo si en ese momento el medicamento
  // quedó pendiente por primera vez o si esa entrega estaba pagando un
  // pendiente ya existente — igual que al guardar en vivo.
  verSoportePdf(grupo: { fecha: Date; items: any[] }) {
    const detail = this.soportesListDetail();
    if (!detail) return;

    const cronologico = [...this.soportesListGrupos()].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    const idx = cronologico.findIndex(g => g.fecha.getTime() === grupo.fecha.getTime());
    const formuladaPorMed = Object.fromEntries(detail.medicamentos.map(m => [m.nombre_medicamento, Number(m.cantidad ?? 0)]));

    const acumuladoAntes: Record<string, number> = {};
    const acumuladoDespues: Record<string, number> = {};
    for (let i = 0; i <= idx; i++) {
      for (const it of cronologico[i].items) {
        const nombre = it.nombre_medicamento;
        if (i < idx) acumuladoAntes[nombre] = (acumuladoAntes[nombre] ?? 0) + Number(it.cantidad);
        acumuladoDespues[nombre] = (acumuladoDespues[nombre] ?? 0) + Number(it.cantidad);
      }
    }

    const items = grupo.items.map(it => ({
      nombre_medicamento: it.nombre_medicamento,
      numero_lote: it.numero_lote,
      cantidad_dispensada: it.cantidad,
      cantidad_pendiente: Math.max(0, (formuladaPorMed[it.nombre_medicamento] ?? 0) - (acumuladoDespues[it.nombre_medicamento] ?? 0))
    }));

    const pendientesNuevos: any[] = [];
    const pendientesContinuados: any[] = [];
    const vistos = new Set<string>();
    for (const it of grupo.items) {
      const nombre = it.nombre_medicamento;
      if (vistos.has(nombre)) continue;
      vistos.add(nombre);
      const formulada = formuladaPorMed[nombre] ?? 0;
      const antes = acumuladoAntes[nombre] ?? 0;
      const despues = acumuladoDespues[nombre] ?? 0;
      const pendienteFinal = Math.max(0, formulada - despues);
      const resumen = { nombre_medicamento: nombre, cantidad_dispensada: despues - antes, cantidad_pendiente: pendienteFinal };
      if (pendienteFinal > 0) {
        if (antes === 0) pendientesNuevos.push(resumen); else pendientesContinuados.push(resumen);
      } else if (antes > 0) {
        pendientesContinuados.push({ ...resumen, cantidad_pendiente: 0 });
      }
    }

    this.generarSoporteEntrega({
      detail,
      items,
      pendientesNuevos,
      pendientesContinuados,
      contrato: null,
      regimen: null,
      observaciones: null,
      fecha: grupo.fecha
    });
  }

  descargarSoporte() {
    if (this.soporteData) this.generarSoporteEntrega(this.soporteData);
    this.finalizarDispensacion();
  }

  omitirSoporte() {
    this.finalizarDispensacion();
  }

  private finalizarDispensacion() {
    const detail = this.selectedDetail();
    this.showSoporteConfirm.set(false);
    this.soporteData = null;
    this.closeModal();
    if (detail) this.loadDetail(detail.id_formulacion);
    this.load();
  }

  private getEtiqueta(options: { valor: string; etiqueta: string }[], valor: string): string {
    return options.find(o => o.valor === valor)?.etiqueta || '—';
  }

  private currentUserName(): string {
    try {
      const user = JSON.parse(localStorage.getItem('akri_user') ?? 'null');
      return user?.name || user?.username || 'Usuario';
    } catch {
      return 'Usuario';
    }
  }

  private generarSoporteEntrega(data: any) {
    const html = this.buildSoporteHtml(data);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // Página resumen para un saldo pendiente — sin bloque de firmas, solo el
  // encabezado, los datos y la tabla filtrada al/los medicamento(s) en cuestión.
  private buildPaginaPendiente(titulo: string, items: any[], detail: any, fechaStr: string, horaStr: string, impresionStr: string): string {
    const filas = items.map(m => `
      <tr>
        <td>${m.nombre_medicamento ?? ''}</td>
        <td style="text-align:center"><strong>${m.cantidad_dispensada ?? 0}</strong></td>
        <td style="text-align:center">${m.cantidad_pendiente ?? 0}</td>
      </tr>
    `).join('');

    return `
  <div class="doc page-break">
    <div class="doc-header">
      <div class="brand">💊 AkriPharmacy<small>Sistema de gestión farmacéutica</small></div>
      <div class="meta">Fecha de impresión<br><strong>${impresionStr}</strong></div>
    </div>
    <div class="doc-title"><h1>${titulo}</h1></div>
    <div class="doc-body">
      <div class="grid">
        <div class="field"><span>Paciente</span><strong>${detail.nombre_paciente}</strong></div>
        <div class="field"><span>Documento</span><strong>${detail.documento_paciente}</strong></div>
        <div class="field"><span>Fecha</span><strong>${fechaStr} ${horaStr}</strong></div>
      </div>
      <table>
        <thead><tr><th>Medicamento</th><th>Cantidad dispensada</th><th>Cantidad pendiente</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
  </div>`;
  }

  private buildSoporteHtml(data: any): string {
    const detail = data.detail;
    const esGeneral: boolean = !!data.esGeneral;
    const fecha: Date = data.fecha;
    const fechaStr = fecha.toLocaleDateString('es-CO');
    const horaStr = fecha.toLocaleTimeString('es-CO');
    const impresionStr = new Date().toLocaleDateString('es-CO') + ' ' + new Date().toLocaleTimeString('es-CO');
    const codigo = `${esGeneral ? 'HG' : 'SE'}-${detail.id_formulacion}-${fecha.getTime()}`;
    const contratoLabel = data.contrato ? this.getEtiqueta(this.contratoOptions, data.contrato) : '—';
    const regimenLabel = data.regimen ? this.getEtiqueta(this.regimenOptions, data.regimen) : '—';
    const usuario = this.currentUserName();

    const filas = (data.items as any[]).map(m => `
      <tr>
        ${esGeneral ? `<td>${m.fechaStr ?? ''}</td>` : ''}
        <td>${m.nombre_medicamento ?? ''}</td>
        <td>${m.numero_lote ?? '—'}</td>
        <td style="text-align:center"><strong>${m.cantidad_dispensada ?? 0}</strong></td>
        <td style="text-align:center">${m.cantidad_pendiente ?? 0}</td>
      </tr>
    `).join('');

    // Página 2: se genera en paralelo a esta misma dispensación cuando deja
    // un saldo pendiente por primera vez. Página 3: cuando esta entrega está
    // pagando/continuando un saldo que ya venía pendiente de una visita anterior.
    // En el consolidado general no aplica esa distinción por acción — en su
    // lugar se muestra el pendiente FINAL acumulado de cada medicamento.
    const pendientesNuevos: any[] = esGeneral ? [] : (data.pendientesNuevos ?? []);
    const pendientesContinuados: any[] = esGeneral ? (data.pendientesFinal ?? []) : (data.pendientesContinuados ?? []);
    const paginaPendiente = pendientesNuevos.length
      ? this.buildPaginaPendiente('Pendiente', pendientesNuevos, detail, fechaStr, horaStr, impresionStr)
      : '';
    const paginaDispensacionPendiente = pendientesContinuados.length
      ? this.buildPaginaPendiente(esGeneral ? 'Pendientes actuales' : 'Dispensación pendiente', pendientesContinuados, detail, fechaStr, horaStr, impresionStr)
      : '';

    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Dispensación de Medicamentos - ${codigo}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color:#1e293b; margin:0; padding:2rem; background:#f8fafc; }
  .doc { max-width:800px; margin:0 auto 2rem; background:#fff; border-radius:4px; box-shadow:0 4px 24px rgba(0,0,0,0.08); overflow:hidden; }
  .doc-header { display:flex; justify-content:space-between; align-items:flex-start; padding:1.25rem 2rem; border-bottom:2px solid #6d28d9; }
  .doc-header .brand { font-size:1.15rem; font-weight:800; color:#6d28d9; }
  .doc-header .brand small { display:block; font-weight:400; font-size:0.72rem; color:#64748b; margin-top:2px; }
  .doc-header .meta { text-align:right; font-size:0.75rem; color:#64748b; }
  .doc-title { text-align:center; padding:0.9rem 2rem 0.4rem; }
  .doc-title h1 { margin:0; font-size:1.05rem; letter-spacing:0.04em; text-transform:uppercase; color:#1e293b; }
  .doc-body { padding:1rem 2rem 1.5rem; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:0.6rem 2rem; margin-bottom:1.25rem; padding-bottom:1rem; border-bottom:1px solid #e2e8f0; }
  .field { font-size:0.85rem; }
  .field span { display:block; color:#94a3b8; font-size:0.72rem; text-transform:uppercase; letter-spacing:0.03em; }
  .field strong { font-size:0.95rem; }
  table { width:100%; border-collapse:collapse; margin-top:0.5rem; font-size:0.85rem; }
  th { background:#f1f5f9; text-align:left; padding:0.5rem 0.6rem; color:#475569; font-size:0.75rem; text-transform:uppercase; }
  td { padding:0.55rem 0.6rem; border-bottom:1px solid #e2e8f0; }
  .obs { margin-top:1rem; font-size:0.85rem; color:#475569; }
  .diligenciar { margin-top:2.5rem; border:1px solid #cbd5e1; border-radius:6px; padding:1.25rem 1.5rem; }
  .diligenciar h2 { margin:0 0 1.4rem; font-size:0.8rem; text-transform:uppercase; letter-spacing:0.04em; color:#475569; }
  .diligenciar-row { display:flex; align-items:flex-end; gap:0.75rem; margin-bottom:1.6rem; font-size:0.85rem; color:#475569; }
  .diligenciar-row:last-child { margin-bottom:0; }
  .diligenciar-row .label { flex:0 0 210px; font-weight:600; }
  .diligenciar-row .linea { flex:1; border-bottom:1px solid #64748b; height:1.1rem; }
  .footer { padding:1rem 2rem; font-size:0.7rem; color:#94a3b8; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; }
  .print-bar { max-width:800px; margin:0 auto 1rem; text-align:right; }
  .print-bar button { background:#7c3aed; color:#fff; border:none; padding:0.5rem 1rem; border-radius:8px; font-size:0.85rem; cursor:pointer; }
  @media print {
    .print-bar { display:none; }
    body { background:#fff; padding:0; }
    .doc { box-shadow:none; margin-bottom:0; }
    .page-break { page-break-before: always; }
  }
</style>
</head>
<body>
  <div class="print-bar"><button onclick="window.print()">Imprimir / Guardar como PDF</button></div>
  <div class="doc">
    <div class="doc-header">
      <div class="brand">💊 AkriPharmacy<small>Sistema de gestión farmacéutica</small></div>
      <div class="meta">Fecha de impresión<br><strong>${impresionStr}</strong></div>
    </div>
    <div class="doc-title"><h1>${esGeneral ? 'Histórico General de Entregas' : 'Dispensación de Medicamentos'}</h1></div>
    <div class="doc-body">
      <div class="grid">
        <div class="field"><span>Paciente</span><strong>${detail.nombre_paciente}</strong></div>
        <div class="field"><span>Documento</span><strong>${detail.documento_paciente}</strong></div>
        <div class="field"><span>Contrato</span><strong>${esGeneral ? (data.contratoGeneral ?? '—') : contratoLabel}</strong></div>
        <div class="field"><span>Régimen</span><strong>${esGeneral ? (data.regimenGeneral ?? '—') : regimenLabel}</strong></div>
        <div class="field"><span>${esGeneral ? 'Periodo' : 'Fecha de entrega'}</span><strong>${esGeneral ? (data.periodoGeneral ?? '—') : `${fechaStr} ${horaStr}`}</strong></div>
        <div class="field"><span>Dispensado por</span><strong>${esGeneral ? (data.dispensadoPorGeneral ?? usuario) : usuario}</strong></div>
      </div>
      <table>
        <thead><tr>${esGeneral ? '<th>Fecha</th>' : ''}<th>Medicamento</th><th>Lote</th><th>Cantidad dispensada</th><th>Cantidad pendiente</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
      ${data.observaciones ? `<div class="obs"><strong>Observaciones:</strong> ${data.observaciones}</div>` : ''}
      <div class="diligenciar">
        <h2>Para diligenciar por el paciente</h2>
        <div class="diligenciar-row"><span class="label">Firma</span><span class="linea"></span></div>
        <div class="diligenciar-row"><span class="label">Documento de identidad</span><span class="linea"></span></div>
        <div class="diligenciar-row"><span class="label">Teléfono</span><span class="linea"></span></div>
        <div class="diligenciar-row"><span class="label">Fecha de entrega</span><span class="linea"></span></div>
        <div class="diligenciar-row"><span class="label">Parentesco (si aplica)</span><span class="linea"></span></div>
      </div>
    </div>
    <div class="footer">
      <span>AkriPharmacy — Documento generado automáticamente por el sistema</span>
      <span>${codigo}</span>
    </div>
  </div>
  ${paginaPendiente}
  ${paginaDispensacionPendiente}
</body>
</html>`;
  }

  getResumenLabel(f: Formulacion): string {
    const c = f.control;
    if (!c || (c.dispensados === 0 && c.parciales === 0)) return 'Pendiente';
    if (c.dispensados >= f.total_medicamentos) return 'Dispensado';
    return 'Parcial';
  }

  getResumenClass(f: Formulacion): string {
    const c = f.control;
    if (!c || (c.dispensados === 0 && c.parciales === 0)) return 'warning';
    if (c.dispensados >= f.total_medicamentos) return 'success';
    return 'error';
  }

  getEstadoLabel(estado: string): string {
    const map: Record<string, string> = {
      pendiente: 'Pendiente', dispensado: 'Dispensado', parcial: 'Parcial', cancelado: 'Cancelado'
    };
    return map[estado] ?? estado;
  }

  getEstadoClass(estado: string): string {
    const map: Record<string, string> = {
      pendiente: 'warning', dispensado: 'success', parcial: 'error', cancelado: 'error'
    };
    return map[estado] ?? '';
  }
}
