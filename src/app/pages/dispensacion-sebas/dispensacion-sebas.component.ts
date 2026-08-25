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
  cantidadDispensadaOverride: number;
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
  modalObs        = '';
  modalContrato   = '';
  modalRegimen    = '';
  modalSaving     = signal(false);
  modalError      = signal('');
  modalSuccess    = signal('');
  showSoporteConfirm = signal(false);
  private soporteData: any = null;

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

  // Pendiente = cantidad formulada - Cant. dispensada (histórico acumulado,
  // editable en vivo en el modal vía cantidadDispensadaOverride).
  getPendiente(item: ModalFormItem): number {
    return Math.max(0, (item.med.cantidad ?? 0) - Number(item.cantidadDispensadaOverride || 0));
  }

  // Faltante = cantidad formulada - lo que se entrega en ESTA acción
  // (no descuenta el histórico previo, a diferencia de "Cant. pendiente").
  getFaltante(item: ModalFormItem): number {
    return Math.max(0, (item.med.cantidad ?? 0) - Number(item.cantidad || 0));
  }

  getMedEntregaMax(med: MedicamentoFormulacion): number {
    const pendiente = this.getMedRestante(med);
    const stock = med.idMedicamento ? this.getMedStockTotal(med.idMedicamento) : 0;
    return Math.min(pendiente, stock);
  }

  hasItemsToDispense(): boolean {
    const items = this.modalFormItems();
    if (items.some(i => !i.med.idMedicamento)) return false;
    const pendingItems = items.filter(i => this.getPendiente(i) > 0);
    if (!pendingItems.length) return false;
    const anyPendingWithNoStock = pendingItems.some(i =>
      !this.stockLoading().has(i.med.idMedicamento) &&
      this.getMedStockTotal(i.med.idMedicamento) === 0
    );
    if (anyPendingWithNoStock) return false;
    return pendingItems.some(i => i.cantidad > 0);
  }

  getMedStock(idMedicamento: number): any[] {
    return this.stockByMed()[idMedicamento] ?? [];
  }

  getMedStockTotal(idMedicamento: number): number {
    return this.getMedStock(idMedicamento).reduce((s, l) => s + Number(l.cantidad_disponible ?? 0), 0);
  }

  private async loadStockForMed(idMedicamento: number) {
    if (!idMedicamento) return;
    this.stockLoading.update(s => new Set([...s, idMedicamento]));
    try {
      const res = await this.api.get<any>(`/inventory/stock/product/${idMedicamento}`);
      const lots = Array.isArray(res) ? res : (res?.data ?? []);
      this.stockByMed.update(m => ({ ...m, [idMedicamento]: lots }));
      // El stock llega después de fijar la cantidad inicial (= pendiente);
      // si hay menos stock que pendiente, hay que bajar la cantidad a entregar.
      this.modalFormItems.update(items => items.map(item => {
        if (item.med.idMedicamento !== idMedicamento) return item;
        const entregaMax = this.getMedEntregaMax(item.med);
        return entregaMax > 0 ? { ...item, cantidad: Math.min(item.cantidad, entregaMax) } : item;
      }));
    } catch {
      this.stockByMed.update(m => ({ ...m, [idMedicamento]: [] }));
    } finally {
      this.stockLoading.update(s => { const n = new Set(s); n.delete(idMedicamento); return n; });
    }
  }

  openFormulacionModal() {
    const detail = this.selectedDetail();
    if (!detail) return;

    const items: ModalFormItem[] = detail.medicamentos
      .filter(m => m.control?.estado !== 'cancelado')
      .map(m => ({
        med: m,
        cantidad: this.getMedRestante(m),
        cantidadDispensadaOverride: m.control?.cantidad_dispensada ?? 0
      }));

    this.modalFormItems.set(items);
    this.modalObs = '';
    this.modalContrato = '';
    this.modalRegimen = '';
    this.modalError.set('');
    this.modalSuccess.set('');
    this.stockByMed.set({});
    this.showModal.set(true);

    for (const item of items) {
      if (item.med.idMedicamento) this.loadStockForMed(item.med.idMedicamento);
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

    const toSave = this.modalFormItems().filter(
      i => !!i.med.idMedicamento && this.getPendiente(i) > 0 && Number(i.cantidad) > 0
    );
    if (!toSave.length) {
      this.modalError.set('No hay medicamentos pendientes por dispensar.');
      return;
    }

    this.modalSaving.set(true);
    this.modalError.set('');
    this.modalSuccess.set('');
    try {
      for (const item of toSave) {
        const dispensadaOriginal = item.med.control?.cantidad_dispensada ?? 0;
        const overrideManual = Number(item.cantidadDispensadaOverride) !== dispensadaOriginal
          ? Number(item.cantidadDispensadaOverride)
          : null;
        await this.api.post<any>('/dispensacion-hs', {
          id_formulacion_hs:                  detail.id_formulacion,
          id_med_formulacion_hs:              item.med.id_med_formulacion,
          cantidad_dispensada:                Number(item.cantidad),
          cantidad_dispensada_total_override: overrideManual,
          cantidad_pendiente_antes:           this.getPendiente(item),
          cantidad_faltante:                  this.getFaltante(item),
          observaciones:                      this.modalObs || null,
          contrato:                           this.modalContrato || null,
          regimen:                            this.modalRegimen || null
        });
      }
      this.modalSuccess.set(`Dispensación registrada (${toSave.length} medicamento${toSave.length > 1 ? 's' : ''}).`);
      this.soporteData = {
        detail,
        items: toSave.map(i => ({ ...i.med, cantidadDispensadaAhora: Number(i.cantidad) })),
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

  async verSoporteGuardado(f: Formulacion) {
    this.error.set('');
    try {
      const res = await this.api.get<any>(`/formulaciones-hs/${f.id_formulacion}`);
      const detail: FormulacionDetail = res.data;
      const dispensados = detail.medicamentos.filter(m => m.control && Number(m.control.cantidad_dispensada) > 0);
      if (!dispensados.length) {
        this.error.set('Esta formulación aún no tiene medicamentos dispensados.');
        return;
      }
      const ultimo = dispensados.reduce((a, b) =>
        new Date(a.control!.fecha_dispensacion ?? 0) > new Date(b.control!.fecha_dispensacion ?? 0) ? a : b
      );
      this.generarSoporteEntrega({
        detail,
        items: dispensados.map(m => ({ ...m, cantidadDispensadaAhora: m.control!.cantidad_dispensada })),
        contrato: ultimo.control!.contrato,
        regimen: ultimo.control!.regimen,
        observaciones: ultimo.control!.observaciones,
        fecha: ultimo.control!.fecha_dispensacion ? new Date(ultimo.control!.fecha_dispensacion) : new Date()
      });
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'No fue posible generar el soporte de entrega.');
    }
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

  private buildSoporteHtml(data: any): string {
    const detail = data.detail;
    const fecha: Date = data.fecha;
    const fechaStr = fecha.toLocaleDateString('es-CO');
    const horaStr = fecha.toLocaleTimeString('es-CO');
    const codigo = `SE-${detail.id_formulacion}-${fecha.getTime()}`;
    const contratoLabel = data.contrato ? this.getEtiqueta(this.contratoOptions, data.contrato) : '—';
    const regimenLabel = data.regimen ? this.getEtiqueta(this.regimenOptions, data.regimen) : '—';
    const usuario = this.currentUserName();

    const filas = (data.items as MedicamentoFormulacion[]).map(m => `
      <tr>
        <td>${m.nombre_medicamento ?? ''}</td>
        <td>${m.presentacion ?? '—'}</td>
        <td>${m.viaAdministracion ?? '—'}</td>
        <td style="text-align:center">${m.cantidad ?? 0}</td>
        <td style="text-align:center"><strong>${(m as any).cantidadDispensadaAhora ?? 0}</strong></td>
      </tr>
    `).join('');

    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Soporte de Entrega - ${codigo}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color:#1e293b; margin:0; padding:2rem; background:#f8fafc; }
  .doc { max-width:800px; margin:0 auto; background:#fff; border-radius:12px; box-shadow:0 4px 24px rgba(0,0,0,0.08); overflow:hidden; }
  .doc-header { background: linear-gradient(135deg,#6d28d9,#7c3aed); color:#fff; padding:1.5rem 2rem; }
  .doc-header h1 { margin:0; font-size:1.3rem; }
  .doc-header p { margin:0.2rem 0 0; opacity:0.85; font-size:0.85rem; }
  .doc-body { padding:1.5rem 2rem; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:0.75rem 2rem; margin-bottom:1.5rem; }
  .field { font-size:0.85rem; }
  .field span { display:block; color:#94a3b8; font-size:0.72rem; text-transform:uppercase; letter-spacing:0.03em; }
  .field strong { font-size:0.95rem; }
  table { width:100%; border-collapse:collapse; margin-top:0.5rem; font-size:0.85rem; }
  th { background:#f1f5f9; text-align:left; padding:0.5rem 0.6rem; color:#475569; font-size:0.75rem; text-transform:uppercase; }
  td { padding:0.55rem 0.6rem; border-bottom:1px solid #e2e8f0; }
  .obs { margin-top:1rem; font-size:0.85rem; color:#475569; }
  .firmas { display:flex; gap:2rem; margin-top:3rem; }
  .firma { flex:1; border-top:1px solid #94a3b8; padding-top:0.4rem; text-align:center; font-size:0.8rem; color:#64748b; }
  .footer { padding:1rem 2rem; font-size:0.7rem; color:#94a3b8; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; }
  .print-bar { max-width:800px; margin:0 auto 1rem; text-align:right; }
  .print-bar button { background:#7c3aed; color:#fff; border:none; padding:0.5rem 1rem; border-radius:8px; font-size:0.85rem; cursor:pointer; }
  @media print { .print-bar { display:none; } body { background:#fff; padding:0; } .doc { box-shadow:none; } }
</style>
</head>
<body>
  <div class="print-bar"><button onclick="window.print()">Imprimir / Guardar como PDF</button></div>
  <div class="doc">
    <div class="doc-header">
      <h1>💊 AkriPharmacy — Soporte de Entrega de Medicamentos</h1>
      <p>Documento N.° ${codigo} · Generado el ${fechaStr} ${horaStr}</p>
    </div>
    <div class="doc-body">
      <div class="grid">
        <div class="field"><span>Paciente</span><strong>${detail.nombre_paciente}</strong></div>
        <div class="field"><span>Documento</span><strong>${detail.documento_paciente}</strong></div>
        <div class="field"><span>#Historia (Atención)</span><strong>${detail.consecutivo_atencion ?? '—'}</strong></div>
        <div class="field"><span>Formulación N.°</span><strong>${detail.id_formulacion}</strong></div>
        <div class="field"><span>Contrato</span><strong>${contratoLabel}</strong></div>
        <div class="field"><span>Régimen</span><strong>${regimenLabel}</strong></div>
        <div class="field"><span>Dispensado por</span><strong>${usuario}</strong></div>
        <div class="field"><span>Fecha y hora de entrega</span><strong>${fechaStr} ${horaStr}</strong></div>
      </div>
      <table>
        <thead><tr><th>Medicamento</th><th>Presentación</th><th>Vía</th><th>Cant. formulada</th><th>Cant. entregada</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
      ${data.observaciones ? `<div class="obs"><strong>Observaciones:</strong> ${data.observaciones}</div>` : ''}
      <div class="firmas">
        <div class="firma">Firma de quien entrega</div>
        <div class="firma">Firma de quien recibe</div>
      </div>
    </div>
    <div class="footer">
      <span>AkriPharmacy — Documento generado automáticamente por el sistema</span>
      <span>${codigo}</span>
    </div>
  </div>
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
