import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

interface Formulacion {
  id_formulacion: number;
  idPaciente: number;
  fechaFormulacion: string;
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

@Component({
  selector: 'akri-dispensacion-sebas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Modal: dispensar medicamento -->
    @if (showModal()) {
      <div class="modal-backdrop" (click)="closeModal()">
        <div class="modal-panel" style="max-width:520px" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>Registrar dispensación</h3>
              <p class="helper" style="margin:0">{{ modalMed()?.nombre_medicamento }}</p>
            </div>
            <button class="btn secondary" (click)="closeModal()">✕ Cerrar</button>
          </div>

          @if (modalError()) {
            <div class="error-box" style="margin-bottom:1rem;">{{ modalError() }}</div>
          }
          @if (modalSuccess()) {
            <div class="success-box" style="margin-bottom:1rem;">{{ modalSuccess() }}</div>
          }

          <div class="form-grid" style="margin-top:1rem;">
            <label style="grid-column:1/-1">
              Paciente
              <input [value]="selectedDetail()?.nombre_paciente ?? ''" disabled>
            </label>
            <label>
              Cantidad formulada
              <input type="number" [value]="modalMed()?.cantidad" disabled>
            </label>
            <label>
              Cantidad a dispensar
              <input type="number" [(ngModel)]="modalForm.cantidad_dispensada" min="0" [max]="modalMed()?.cantidad ?? 9999">
            </label>
            <label style="grid-column:1/-1">
              Observaciones
              <textarea [(ngModel)]="modalForm.observaciones" rows="2" placeholder="Observaciones de la dispensación…"></textarea>
            </label>
          </div>

          <div class="form-actions" style="margin-top:1rem;">
            <button class="btn" [disabled]="modalSaving()" (click)="saveDispensacion()">
              {{ modalSaving() ? 'Guardando…' : 'Confirmar dispensación' }}
            </button>
            <button class="btn secondary" (click)="closeModal()">Cancelar</button>
          </div>
        </div>
      </div>
    }

    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Dispensación HS</h1>
          <p class="page-subtitle">Formulaciones de HealthSphere — control de dispensación de medicamentos.</p>
        </div>
        <div class="toolbar" style="margin-bottom:0">
          <button class="btn secondary" (click)="load()">Actualizar</button>
        </div>
      </div>

      @if (error()) {
        <div class="error-box" style="margin-bottom:1rem;">{{ error() }}</div>
      }

      <!-- Filtros -->
      <div class="toolbar" style="margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
        <input
          [(ngModel)]="search"
          (ngModelChange)="onSearchChange()"
          placeholder="Buscar por paciente, documento…"
          style="flex:1; min-width:200px; max-width:360px;">
        <select [(ngModel)]="filterEstado" (ngModelChange)="load()" style="min-width:150px;">
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="parcial">Parcial</option>
          <option value="dispensado">Dispensado</option>
        </select>
        <span class="muted" style="align-self:center; font-size:0.85rem;">
          {{ total() }} formulaciones
        </span>
      </div>

      @if (loading()) {
        <div class="loading-state">Cargando formulaciones…</div>
      } @else if (formulaciones().length === 0) {
        <div class="empty-state">No se encontraron formulaciones.</div>
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th style="width:32px"></th>
                <th>Paciente</th>
                <th>Documento</th>
                <th>Fecha formulación</th>
                <th>Meds.</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (f of formulaciones(); track f.id_formulacion) {
                <tr [class.row-expanded]="expandedId() === f.id_formulacion">
                  <td>
                    <button class="btn-icon" (click)="toggleExpand(f.id_formulacion)"
                            [title]="expandedId() === f.id_formulacion ? 'Colapsar' : 'Ver medicamentos'">
                      {{ expandedId() === f.id_formulacion ? '▲' : '▼' }}
                    </button>
                  </td>
                  <td><strong>{{ f.nombre_paciente }}</strong></td>
                  <td class="muted">{{ f.documento_paciente }}</td>
                  <td class="muted">{{ f.fechaFormulacion | date:'dd/MM/yyyy' }}</td>
                  <td style="text-align:center">
                    <span class="chip info">{{ f.total_medicamentos }}</span>
                  </td>
                  <td>
                    <span class="chip" [class]="getResumenClass(f)">{{ getResumenLabel(f) }}</span>
                  </td>
                  <td>
                    <button class="btn btn-small" (click)="toggleExpand(f.id_formulacion)">
                      {{ expandedId() === f.id_formulacion ? 'Colapsar' : 'Ver detalle' }}
                    </button>
                  </td>
                </tr>

                <!-- Fila expandida con medicamentos -->
                @if (expandedId() === f.id_formulacion) {
                  <tr class="detail-row">
                    <td colspan="7" style="padding:0; background:#f8fafc;">
                      @if (detailLoading()) {
                        <div style="padding:1.5rem; text-align:center; color:#64748b;">Cargando medicamentos…</div>
                      } @else if (selectedDetail()) {
                        <div style="padding:1rem 1.5rem;">

                          <!-- Info paciente -->
                          <div style="display:flex; gap:2rem; flex-wrap:wrap; margin-bottom:0.75rem; font-size:0.85rem; color:#475569;">
                            <span><strong>Paciente:</strong> {{ selectedDetail()!.nombre_paciente }}</span>
                            <span><strong>Doc:</strong> {{ selectedDetail()!.documento_paciente }}</span>
                            @if (selectedDetail()!.celular_paciente) {
                              <span><strong>Cel:</strong> {{ selectedDetail()!.celular_paciente }}</span>
                            }
                            @if (selectedDetail()!.direccion_paciente) {
                              <span><strong>Dir:</strong> {{ selectedDetail()!.direccion_paciente }}</span>
                            }
                          </div>

                          <!-- Tabla de medicamentos -->
                          <table class="inner-table">
                            <thead>
                              <tr>
                                <th>Medicamento</th>
                                <th>Presentación</th>
                                <th>Vía</th>
                                <th>Cantidad</th>
                                <th>Diagnóstico</th>
                                <th>Estado</th>
                                <th>Acción</th>
                              </tr>
                            </thead>
                            <tbody>
                              @for (med of selectedDetail()!.medicamentos; track med.id_med_formulacion) {
                                <tr>
                                  <td>
                                    <strong>{{ med.nombre_medicamento }}</strong>
                                    @if (med.pbs) {
                                      <span class="chip success" style="font-size:0.65rem; margin-left:4px;">PBS</span>
                                    }
                                  </td>
                                  <td class="muted">{{ med.presentacion }}</td>
                                  <td class="muted">{{ med.viaAdministracion }}</td>
                                  <td style="text-align:center">
                                    @if (med.control) {
                                      <span>{{ med.control.cantidad_dispensada }}/{{ med.control.cantidad_formulada }}</span>
                                    } @else {
                                      <span>{{ med.cantidad }}</span>
                                    }
                                  </td>
                                  <td class="muted" style="font-size:0.8rem;">{{ med.diagnostico || '—' }}</td>
                                  <td>
                                    <span class="chip {{ getEstadoClass(med.control?.estado ?? 'pendiente') }}">
                                      {{ getEstadoLabel(med.control?.estado ?? 'pendiente') }}
                                    </span>
                                  </td>
                                  <td>
                                    @if (med.control?.estado !== 'cancelado') {
                                      <button class="btn btn-small"
                                              [class.secondary]="med.control?.estado === 'dispensado'"
                                              (click)="openDispensarModal(med)">
                                        {{ med.control?.estado === 'dispensado' ? 'Actualizar' : 'Dispensar' }}
                                      </button>
                                    }
                                  </td>
                                </tr>
                              }
                            </tbody>
                          </table>
                        </div>
                      }
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        <!-- Paginación -->
        @if (totalPages > 1) {
          <div style="margin-top:1rem; display:flex; gap:0.5rem; align-items:center; justify-content:flex-end;">
            <button class="btn secondary btn-small" [disabled]="page() === 1" (click)="goPage(page() - 1)">← Anterior</button>
            <span class="muted" style="font-size:0.85rem;">Pág. {{ page() }} / {{ totalPages }}</span>
            <button class="btn secondary btn-small" [disabled]="page() === totalPages" (click)="goPage(page() + 1)">Siguiente →</button>
          </div>
        }
      }
    </section>
  `,
  styles: [`
    .row-expanded td { background: #f0f9ff; }
    .detail-row td { border-top: none; }
    .inner-table { width:100%; border-collapse:collapse; font-size:0.85rem; }
    .inner-table th { background:#e2e8f0; padding:0.4rem 0.75rem; text-align:left; font-weight:600; color:#475569; }
    .inner-table td { padding:0.5rem 0.75rem; border-bottom:1px solid #e2e8f0; vertical-align:middle; }
    .inner-table tr:last-child td { border-bottom:none; }
    .btn-icon { background:none; border:none; cursor:pointer; font-size:0.9rem; color:#64748b; padding:2px 6px; border-radius:4px; }
    .btn-icon:hover { background:#e2e8f0; }
    .btn-small { padding:0.25rem 0.65rem; font-size:0.8rem; }
    .loading-state, .empty-state { padding:3rem; text-align:center; color:#94a3b8; }
  `]
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
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  expandedId     = signal<number | null>(null);
  selectedDetail = signal<FormulacionDetail | null>(null);
  detailLoading  = signal(false);

  showModal    = signal(false);
  modalMed     = signal<MedicamentoFormulacion | null>(null);
  modalForm    = { cantidad_dispensada: 0, observaciones: '' };
  modalSaving  = signal(false);
  modalError   = signal('');
  modalSuccess = signal('');

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

      const res = await this.api.get<any>(`/formulaciones-hs?${params}`);
      this.formulaciones.set(res.data ?? []);
      this.total.set(res.total ?? 0);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Error al cargar formulaciones');
    } finally {
      this.loading.set(false);
    }
  }

  onSearchChange() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.load();
    }, 400);
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
      // error silencioso — la fila simplemente no expande
    } finally {
      this.detailLoading.set(false);
    }
  }

  openDispensarModal(med: MedicamentoFormulacion) {
    this.modalMed.set(med);
    this.modalForm = {
      cantidad_dispensada: med.control?.cantidad_dispensada ?? med.cantidad,
      observaciones: med.control?.observaciones ?? ''
    };
    this.modalError.set('');
    this.modalSuccess.set('');
    this.showModal.set(true);
  }

  closeModal() {
    if (this.modalSaving()) return;
    this.showModal.set(false);
    this.modalMed.set(null);
  }

  async saveDispensacion() {
    const med    = this.modalMed();
    const detail = this.selectedDetail();
    if (!med || !detail) return;

    this.modalSaving.set(true);
    this.modalError.set('');
    this.modalSuccess.set('');
    try {
      await this.api.post<any>('/dispensacion-hs', {
        id_formulacion_hs:     detail.id_formulacion,
        id_med_formulacion_hs: med.id_med_formulacion,
        cantidad_dispensada:   Number(this.modalForm.cantidad_dispensada),
        observaciones:         this.modalForm.observaciones || null
      });
      this.modalSuccess.set('Dispensación registrada correctamente.');
      setTimeout(() => {
        this.closeModal();
        this.loadDetail(detail.id_formulacion);
        this.load();
      }, 800);
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
    return 'info';
  }

  getEstadoLabel(estado: string): string {
    const map: Record<string, string> = {
      pendiente: 'Pendiente', dispensado: 'Dispensado', parcial: 'Parcial', cancelado: 'Cancelado'
    };
    return map[estado] ?? estado;
  }

  getEstadoClass(estado: string): string {
    const map: Record<string, string> = {
      pendiente: 'warning', dispensado: 'success', parcial: 'info', cancelado: 'error'
    };
    return map[estado] ?? '';
  }
}
