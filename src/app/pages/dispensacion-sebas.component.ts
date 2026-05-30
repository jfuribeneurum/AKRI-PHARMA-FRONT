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

interface ModalFormItem {
  med: MedicamentoFormulacion;
  cantidad: number;
}

@Component({
  selector: 'akri-dispensacion-sebas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Modal: dispensar formulación completa -->
    @if (showModal()) {
      <div class="modal-backdrop" (click)="closeModal()">
        <div class="disp-modal" (click)="$event.stopPropagation()">

          <!-- Header -->
          <div class="disp-modal__header">
            <div class="disp-modal__header-icon">💊</div>
            <div class="disp-modal__header-text">
              <span class="disp-modal__header-sup">Dispensación de formulación</span>
              <strong class="disp-modal__header-med">{{ selectedDetail()?.nombre_paciente }}</strong>
            </div>
            <button class="disp-modal__close" (click)="closeModal()" title="Cerrar">✕</button>
          </div>

          <!-- Body scrollable -->
          <div class="disp-modal__body">

            @if (modalError()) {
              <div class="error-box">{{ modalError() }}</div>
            }
            @if (modalSuccess()) {
              <div class="success-box">{{ modalSuccess() }}</div>
            }

            <!-- Paciente -->
            <div class="disp-modal__patient">
              <span class="disp-modal__patient-icon">👤</span>
              <span class="disp-modal__patient-name">{{ selectedDetail()?.nombre_paciente }}</span>
              <span class="disp-modal__patient-doc">{{ selectedDetail()?.documento_paciente }}</span>
            </div>

            <!-- Lista de medicamentos -->
            <div class="disp-med-list">
              @for (item of modalFormItems(); track item.med.id_med_formulacion) {
                <div class="disp-med-card" [class.disp-med-card--done]="getMedRestante(item.med) === 0">

                  <!-- Info izquierda -->
                  <div class="disp-med-card__info">
                    <div class="disp-med-card__name">{{ item.med.nombre_medicamento }}</div>
                    <div class="disp-med-card__meta">
                      @if (item.med.presentacion) {
                        <span>{{ item.med.presentacion }}</span>
                      }
                      @if (item.med.viaAdministracion) {
                        <span class="disp-med-card__sep">·</span>
                        <span>{{ item.med.viaAdministracion }}</span>
                      }
                      @if (item.med.pbs) {
                        <span class="chip success" style="font-size:0.6rem; margin-left:4px;">PBS</span>
                      }
                    </div>
                  </div>

                  <!-- Controles derecha -->
                  <div class="disp-med-card__right">
                    <!-- Stats compactos -->
                    <div class="disp-med-card__stats">
                      <div class="dsm dsm--neutral">
                        <span class="dsm__v">{{ item.med.cantidad }}</span>
                        <span class="dsm__l">Form.</span>
                      </div>
                      <div class="dsm dsm--blue">
                        <span class="dsm__v">{{ item.med.control?.cantidad_dispensada ?? 0 }}</span>
                        <span class="dsm__l">Disp.</span>
                      </div>
                      <div class="dsm" [class]="getMedRestante(item.med) === 0 ? 'dsm--green' : 'dsm--red'">
                        <span class="dsm__v">{{ getMedRestante(item.med) }}</span>
                        <span class="dsm__l">Rest.</span>
                      </div>
                    </div>

                    @if (getMedRestante(item.med) === 0) {
                      <div class="disp-med-card__done-badge">✅ Completado</div>
                    } @else {
                      <div class="disp-med-card__stepper">
                        <button class="stp-btn" (click)="stepItem(item, -1)"
                                [disabled]="item.cantidad <= 1">−</button>
                        <input class="stp-input" type="number"
                               [(ngModel)]="item.cantidad"
                               [min]="1" [max]="getMedRestante(item.med)">
                        <button class="stp-btn" (click)="stepItem(item, 1)"
                                [disabled]="item.cantidad >= getMedRestante(item.med)">+</button>
                      </div>
                    }
                  </div>

                </div>
              }
            </div>

            <!-- Observaciones -->
            <label class="disp-modal__obs-label">
              Observaciones
              <span style="color:#94a3b8; font-weight:400; margin-left:4px;">(opcional — aplica a todos)</span>
              <textarea class="disp-modal__obs-input" [(ngModel)]="modalObs"
                        rows="2" placeholder="Ej: entrega parcial por falta de stock…"></textarea>
            </label>
          </div>

          <!-- Footer -->
          <div class="disp-modal__footer">
            <button class="disp-modal__btn-cancel" (click)="closeModal()" [disabled]="modalSaving()">
              Cancelar
            </button>
            <button class="disp-modal__btn-confirm"
                    [disabled]="modalSaving() || !hasItemsToDispense()"
                    (click)="saveDispensacion()">
              @if (modalSaving()) {
                <span class="disp-modal__spinner"></span> Guardando…
              } @else {
                ✔ Confirmar dispensación
              }
            </button>
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
      <div class="toolbar" style="margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem; align-items:center;">
        <input
          [(ngModel)]="search"
          (ngModelChange)="onSearchChange()"
          placeholder="Buscar por paciente, documento…"
          style="flex:1; min-width:180px; max-width:300px;">

        <select [(ngModel)]="filterEstado" (ngModelChange)="resetAndLoad()" style="min-width:140px;">
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="parcial">Parcial</option>
          <option value="dispensado">Dispensado</option>
        </select>

        <label style="display:flex; align-items:center; gap:0.35rem; font-size:0.85rem; color:#475569; margin:0;">
          Desde
          <input type="date" [(ngModel)]="fechaDesde" (ngModelChange)="resetAndLoad()"
                 style="padding:0.35rem 0.5rem; font-size:0.85rem;">
        </label>

        <label style="display:flex; align-items:center; gap:0.35rem; font-size:0.85rem; color:#475569; margin:0;">
          Hasta
          <input type="date" [(ngModel)]="fechaHasta" (ngModelChange)="resetAndLoad()"
                 style="padding:0.35rem 0.5rem; font-size:0.85rem;">
        </label>

        @if (fechaDesde || fechaHasta || filterEstado || search) {
          <button class="btn secondary btn-small" (click)="clearFilters()" title="Limpiar filtros">✕ Limpiar</button>
        }

        <span class="muted" style="font-size:0.85rem; margin-left:auto;">
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

                          <!-- Info paciente + botón dispensar -->
                          <div style="display:flex; align-items:center; flex-wrap:wrap; gap:1rem; margin-bottom:0.75rem;">
                            <div style="display:flex; gap:2rem; flex-wrap:wrap; font-size:0.85rem; color:#475569; flex:1;">
                              <span><strong>Paciente:</strong> {{ selectedDetail()!.nombre_paciente }}</span>
                              <span><strong>Doc:</strong> {{ selectedDetail()!.documento_paciente }}</span>
                              @if (selectedDetail()!.celular_paciente) {
                                <span><strong>Cel:</strong> {{ selectedDetail()!.celular_paciente }}</span>
                              }
                              @if (selectedDetail()!.direccion_paciente) {
                                <span><strong>Dir:</strong> {{ selectedDetail()!.direccion_paciente }}</span>
                              }
                            </div>
                            <button class="btn btn-small" (click)="openFormulacionModal()">
                              💊 Dispensar formulación
                            </button>
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
    /* ── Tabla principal ── */
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

    /* ── Modal dispensación ── */
    :host .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.45);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }

    .disp-modal {
      background: #fff;
      border-radius: 20px;
      box-shadow: 0 32px 80px rgba(0,0,0,0.22);
      width: 100%;
      max-width: 780px;
      max-height: 90vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      margin: auto;
    }

    /* Header */
    .disp-modal__header {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.5rem 1.75rem;
      background: linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%);
      color: #fff;
      flex-shrink: 0;
    }
    .disp-modal__header-icon {
      font-size: 2rem;
      flex-shrink: 0;
      background: rgba(255,255,255,0.15);
      border-radius: 12px;
      width: 54px; height: 54px;
      display: flex; align-items: center; justify-content: center;
    }
    .disp-modal__header-text { flex: 1; min-width: 0; }
    .disp-modal__header-sup { display: block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: .08em; opacity: .75; margin-bottom: 2px; }
    .disp-modal__header-med { display: block; font-size: 1.1rem; font-weight: 700; line-height: 1.3; }
    .disp-modal__close {
      flex-shrink: 0;
      background: rgba(255,255,255,0.15);
      border: none; color: #fff; cursor: pointer;
      border-radius: 10px; width: 38px; height: 38px;
      font-size: 1rem; display: flex; align-items: center; justify-content: center;
      transition: background .15s;
    }
    .disp-modal__close:hover { background: rgba(255,255,255,0.3); }

    /* Body */
    .disp-modal__body {
      padding: 1.25rem 1.75rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      overflow-y: auto;
      flex: 1;
    }

    /* Paciente */
    .disp-modal__patient {
      display: flex; align-items: center; gap: 0.6rem;
      background: #f8fafc; border: 1px solid #e2e8f0;
      border-radius: 10px; padding: 0.65rem 1rem;
      flex-shrink: 0;
    }
    .disp-modal__patient-icon { font-size: 1.1rem; }
    .disp-modal__patient-name { font-weight: 600; font-size: 0.92rem; color: #1e293b; flex: 1; }
    .disp-modal__patient-doc { font-size: 0.8rem; color: #94a3b8; }

    /* Lista de medicamentos */
    .disp-med-list { display: flex; flex-direction: column; gap: 0.6rem; }

    /* Tarjeta de medicamento */
    .disp-med-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 0.85rem 1rem;
      background: #fff;
      transition: border-color .15s;
    }
    .disp-med-card:not(.disp-med-card--done):hover { border-color: #c4b5fd; }
    .disp-med-card--done {
      background: #f0fdf4;
      border-color: #bbf7d0;
      opacity: 0.85;
    }

    /* Info izquierda */
    .disp-med-card__info { flex: 1; min-width: 0; }
    .disp-med-card__name {
      font-weight: 700; font-size: 0.88rem; color: #1e293b;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .disp-med-card__meta {
      display: flex; align-items: center; gap: 0.25rem;
      font-size: 0.75rem; color: #94a3b8; margin-top: 2px;
    }
    .disp-med-card__sep { color: #cbd5e1; }

    /* Controles derecha */
    .disp-med-card__right {
      display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0;
    }

    /* Stats compactos (dsm = dispensation stat mini) */
    .disp-med-card__stats { display: flex; gap: 0.4rem; }
    .dsm {
      border-radius: 8px; padding: 0.35rem 0.5rem;
      display: flex; flex-direction: column; align-items: center; gap: 1px;
      min-width: 46px;
    }
    .dsm--neutral { background: #f1f5f9; border: 1px solid #e2e8f0; }
    .dsm--blue    { background: #eff6ff; border: 1px solid #bfdbfe; }
    .dsm--red     { background: #fff1f2; border: 1px solid #fecdd3; }
    .dsm--green   { background: #f0fdf4; border: 1px solid #bbf7d0; }
    .dsm__v {
      font-size: 1.1rem; font-weight: 800; line-height: 1;
    }
    .dsm--neutral .dsm__v { color: #475569; }
    .dsm--blue    .dsm__v { color: #2563eb; }
    .dsm--red     .dsm__v { color: #dc2626; }
    .dsm--green   .dsm__v { color: #16a34a; }
    .dsm__l { font-size: 0.6rem; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; font-weight: 600; }

    /* Completado badge */
    .disp-med-card__done-badge {
      font-size: 0.75rem; font-weight: 600; color: #16a34a;
      background: #f0fdf4; border: 1px solid #bbf7d0;
      border-radius: 8px; padding: 0.35rem 0.75rem;
      white-space: nowrap;
    }

    /* Stepper por medicamento */
    .disp-med-card__stepper {
      display: flex; align-items: center;
      border: 2px solid #7c3aed; border-radius: 10px; overflow: hidden;
      background: #fff;
    }
    .stp-btn {
      background: #f5f3ff; border: none; cursor: pointer;
      width: 36px; height: 36px; font-size: 1.1rem; font-weight: 700;
      color: #6d28d9; flex-shrink: 0; transition: background .15s;
    }
    .stp-btn:hover:not(:disabled) { background: #ede9fe; }
    .stp-btn:disabled { color: #d1d5db; cursor: not-allowed; }
    .stp-input {
      width: 52px; border: none; outline: none;
      text-align: center; font-size: 1.1rem; font-weight: 800;
      color: #4c1d95; padding: 0.2rem 0;
      -moz-appearance: textfield;
    }
    .stp-input::-webkit-inner-spin-button,
    .stp-input::-webkit-outer-spin-button { -webkit-appearance: none; }

    /* Observaciones */
    .disp-modal__obs-label { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.82rem; font-weight: 600; color: #374151; }
    .disp-modal__obs-input {
      width: 100%; border: 1px solid #e2e8f0; border-radius: 8px;
      padding: 0.6rem 0.75rem; font-size: 0.85rem; color: #374151;
      resize: vertical; font-family: inherit;
      transition: border-color .15s; box-sizing: border-box;
    }
    .disp-modal__obs-input:focus { outline: none; border-color: #7c3aed; }

    /* Footer */
    .disp-modal__footer {
      display: flex; gap: 0.75rem; padding: 1rem 1.75rem;
      border-top: 1px solid #f1f5f9; background: #fafafa;
      justify-content: flex-end; flex-shrink: 0;
    }
    .disp-modal__btn-cancel {
      background: #fff; border: 1px solid #e2e8f0; color: #475569;
      padding: 0.6rem 1.25rem; border-radius: 8px; font-size: 0.88rem;
      font-weight: 600; cursor: pointer; transition: background .15s;
    }
    .disp-modal__btn-cancel:hover:not(:disabled) { background: #f1f5f9; }
    .disp-modal__btn-confirm {
      background: linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%);
      border: none; color: #fff;
      padding: 0.6rem 1.4rem; border-radius: 8px; font-size: 0.88rem;
      font-weight: 700; cursor: pointer; transition: opacity .15s;
      display: flex; align-items: center; gap: 0.4rem;
    }
    .disp-modal__btn-confirm:hover:not(:disabled) { opacity: .88; }
    .disp-modal__btn-confirm:disabled { opacity: .5; cursor: not-allowed; }

    /* Spinner */
    .disp-modal__spinner {
      width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.4);
      border-top-color: #fff; border-radius: 50%;
      animation: spin .6s linear infinite; display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
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
    return this.modalFormItems().some(i => this.getMedRestante(i.med) > 0 && i.cantidad > 0);
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
    this.showModal.set(true);
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
      i => this.getMedRestante(i.med) > 0 && Number(i.cantidad) > 0
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
