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
  modalSaving     = signal(false);
  modalError      = signal('');
  modalSuccess    = signal('');

  readonly stockByMed   = signal<Record<number, any[]>>({});
  readonly stockLoading = signal<Set<number>>(new Set());

  get totalPages(): number { return Math.max(1, Math.ceil(this.total() / this.limit)); }

  constructor(private api: ApiService) {}

  ngOnInit() { this.load(); }

  async load() {
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

  getMedRestante(med: MedicamentoFormulacion): number {
    return Math.max(0, (med.cantidad ?? 0) - (med.control?.cantidad_dispensada ?? 0));
  }

  stepItem(item: ModalFormItem, delta: number) {
    const max = this.getMedRestante(item.med);
    item.cantidad = Math.min(max, Math.max(1, Number(item.cantidad) + delta));
  }

  hasItemsToDispense(): boolean {
    const items = this.modalFormItems();
    if (items.some(i => !i.med.idMedicamento)) return false;
    const pendingItems = items.filter(i => this.getMedRestante(i.med) > 0);
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
        cantidad: this.getMedRestante(m)
      }));

    this.modalFormItems.set(items);
    this.modalObs = '';
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
    this.modalFormItems.set([]);
  }

  async saveDispensacion() {
    const detail = this.selectedDetail();
    if (!detail) return;

    const toSave = this.modalFormItems().filter(
      i => !!i.med.idMedicamento && this.getMedRestante(i.med) > 0 && Number(i.cantidad) > 0
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
        await this.api.post<any>('/dispensacion-hs', {
          id_formulacion_hs:     detail.id_formulacion,
          id_med_formulacion_hs: item.med.id_med_formulacion,
          cantidad_dispensada:   Number(item.cantidad),
          observaciones:         this.modalObs || null
        });
      }
      this.modalSuccess.set(`Dispensación registrada (${toSave.length} medicamento${toSave.length > 1 ? 's' : ''}).`);
      setTimeout(() => {
        this.closeModal();
        this.loadDetail(detail.id_formulacion);
        this.load();
      }, 900);
    } catch (err: any) {
      this.modalError.set(err?.error?.message ?? 'Error al registrar la dispensación');
    } finally {
      this.modalSaving.set(false);
    }
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
