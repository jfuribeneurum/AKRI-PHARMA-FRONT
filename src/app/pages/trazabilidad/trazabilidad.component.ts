import { Component, OnInit, signal, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

interface TraceEntry {
  id_traza: number;
  request_id: string;
  fecha_hora: string;
  proceso: string;
  subproceso: string | null;
  estado: 'terminado' | 'parcial' | 'cancelado' | 'error';
  id_sede: number | null;
  sede: string | null;
  id_usuario: number | null;
  usuario: string | null;
  perfil_nombre: string | null;
  referencia_tipo: string | null;
  referencia_id: number | null;
  descripcion: string | null;
  endpoint: string | null;
  http_method: string | null;
  http_status: number | null;
  duracion_ms: number | null;
  payload_json: Record<string, unknown> | null;
}

interface UserActivity {
  id_usuario: number;
  usuario: string | null;
  perfil_nombre: string | null;
  total_acciones: number;
  exitosas: number;
  errores: number;
  parciales: number;
  ultima_accion: string;
  primera_accion: string;
  duracion_prom_ms: number | null;
  modulos_usados: string | null;
}

const PROCESOS = [
  '', 'AUTH', 'PURCHASES', 'INGRESOS', 'INVENTORY', 'SALES',
  'DISPENSACION-HS', 'DISPENSING', 'TRACEABILITY', 'DASHBOARD',
  'PRODUCTS', 'PROVIDERS', 'REPORTS', 'ADMIN', 'BILLING',
  'COLD-CHAIN', 'MULTISITE', 'PACIENTES', 'CIUDADES'
];

type Tab = 'procesos' | 'usuarios';

@Component({
  selector: 'akri-trazabilidad',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-wrap">
      <div class="page-header">
        <div>
          <h2 class="page-title">Trazabilidad</h2>
          <p class="page-sub">Registro completo de todas las acciones realizadas por usuario en el sistema</p>
        </div>
        <button class="btn-refresh" (click)="loadActive()" [disabled]="loading()">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Actualizar
        </button>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button class="tab" [class.active]="tab === 'procesos'" (click)="setTab('procesos')">
          Movimientos / Acciones
        </button>
        <button class="tab" [class.active]="tab === 'usuarios'" (click)="setTab('usuarios')">
          Actividad por usuario
        </button>
      </div>

      <!-- ═══════ TAB: PROCESOS ═══════ -->
      @if (tab === 'procesos') {
        <div class="filters-card">
          <div class="filters-row">
            <label class="filter-label">
              Desde
              <input type="date" [(ngModel)]="filter.date_from" (change)="loadProcesos()" />
            </label>
            <label class="filter-label">
              Hasta
              <input type="date" [(ngModel)]="filter.date_to" (change)="loadProcesos()" />
            </label>
            <label class="filter-label">
              Módulo
              <select [(ngModel)]="filter.proceso" (change)="loadProcesos()">
                <option value="">Todos</option>
                @for (p of procesos; track p) {
                  @if (p) { <option [value]="p">{{ p }}</option> }
                }
              </select>
            </label>
            <label class="filter-label">
              Estado
              <select [(ngModel)]="filter.estado" (change)="applyLocalFilter()">
                <option value="">Todos</option>
                <option value="terminado">Exitoso</option>
                <option value="parcial">Parcial</option>
                <option value="error">Error</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </label>
            <label class="filter-label grow">
              Buscar
              <input type="search" placeholder="Usuario, descripción, endpoint…" [(ngModel)]="filter.search" (input)="onSearchChange()" />
            </label>
            <label class="filter-label">
              Límite
              <select [(ngModel)]="filter.limit" (change)="loadProcesos()">
                <option [value]="50">50</option>
                <option [value]="100">100</option>
                <option [value]="250">250</option>
                <option [value]="500">500</option>
              </select>
            </label>
          </div>
        </div>

        @if (data().length) {
          <div class="quick-stats">
            <div class="qs-item">
              <span class="qs-num">{{ filteredData().length }}</span>
              <span class="qs-lbl">Registros</span>
            </div>
            <div class="qs-item">
              <span class="qs-num ok">{{ countByEstado('terminado') }}</span>
              <span class="qs-lbl">Exitosos</span>
            </div>
            <div class="qs-item">
              <span class="qs-num warn">{{ countByEstado('parcial') }}</span>
              <span class="qs-lbl">Parciales</span>
            </div>
            <div class="qs-item">
              <span class="qs-num err">{{ countByEstado('error') }}</span>
              <span class="qs-lbl">Errores</span>
            </div>
            <div class="qs-item">
              <span class="qs-num">{{ avgDuration() }}ms</span>
              <span class="qs-lbl">Duración prom.</span>
            </div>
          </div>
        }

        @if (error()) {
          <div class="alert-error">{{ error() }}</div>
        }

        <div class="table-wrap">
          @if (loading()) {
            <div class="loading-row"><div class="spinner"></div> Cargando registros…</div>
          } @else if (!filteredData().length) {
            <div class="empty-msg">No hay registros con los filtros seleccionados.</div>
          } @else {
            <table class="trace-table">
              <thead>
                <tr>
                  <th>Fecha / Hora</th>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Sede</th>
                  <th>Módulo</th>
                  <th>Submódulo</th>
                  <th>Método</th>
                  <th>Endpoint</th>
                  <th>Estado</th>
                  <th>HTTP</th>
                  <th>ms</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (row of filteredData(); track row.id_traza) {
                  <tr [class.expanded-row]="expanded === row.id_traza">
                    <td class="mono nowrap">{{ formatDate(row.fecha_hora) }}</td>
                    <td class="fw6">{{ row.usuario ?? '—' }}</td>
                    <td>
                      @if (row.perfil_nombre) {
                        <span class="badge-role">{{ row.perfil_nombre }}</span>
                      } @else { <span class="muted">—</span> }
                    </td>
                    <td class="small">{{ row.sede ?? '—' }}</td>
                    <td><span class="badge-mod">{{ row.proceso }}</span></td>
                    <td class="muted small">{{ row.subproceso ?? '—' }}</td>
                    <td>
                      @if (row.http_method) {
                        <span class="method" [attr.data-method]="row.http_method">{{ row.http_method }}</span>
                      } @else { <span class="muted">—</span> }
                    </td>
                    <td class="mono small endpoint" [title]="row.endpoint ?? ''">{{ truncate(row.endpoint ?? '—', 42) }}</td>
                    <td>
                      <span class="badge-estado" [attr.data-estado]="row.estado">{{ estadoLabel(row.estado) }}</span>
                    </td>
                    <td>
                      @if (row.http_status) {
                        <span class="http-status"
                          [class.ok]="row.http_status < 300"
                          [class.warn]="row.http_status >= 400 && row.http_status < 500"
                          [class.err]="row.http_status >= 500">{{ row.http_status }}</span>
                      } @else { <span class="muted">—</span> }
                    </td>
                    <td class="mono small">{{ row.duracion_ms ?? '—' }}</td>
                    <td>
                      <button class="btn-expand" (click)="toggleExpand(row.id_traza)">
                        {{ expanded === row.id_traza ? '▲' : '▼' }}
                      </button>
                    </td>
                  </tr>
                  @if (expanded === row.id_traza) {
                    <tr class="detail-row">
                      <td colspan="12">
                        <div class="detail-box">
                          <div class="detail-grid">
                            <div class="dg-item">
                              <span class="dg-lbl">Request ID</span>
                              <span class="dg-val mono small">{{ row.request_id }}</span>
                            </div>
                            <div class="dg-item">
                              <span class="dg-lbl">Descripción</span>
                              <span class="dg-val">{{ row.descripcion ?? '—' }}</span>
                            </div>
                            @if (row.referencia_tipo) {
                              <div class="dg-item">
                                <span class="dg-lbl">Referencia</span>
                                <span class="dg-val">{{ row.referencia_tipo }} #{{ row.referencia_id }}</span>
                              </div>
                            }
                            @if (row.payload_json) {
                              <div class="dg-item full">
                                <span class="dg-lbl">Payload</span>
                                <pre class="dg-pre">{{ formatJson(row.payload_json) }}</pre>
                              </div>
                            }
                          </div>
                        </div>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          }
        </div>
      }

      <!-- ═══════ TAB: ACTIVIDAD POR USUARIO ═══════ -->
      @if (tab === 'usuarios') {
        <div class="filters-card">
          <div class="filters-row">
            <label class="filter-label">
              Desde
              <input type="date" [(ngModel)]="filterU.date_from" (change)="loadUsuarios()" />
            </label>
            <label class="filter-label">
              Hasta
              <input type="date" [(ngModel)]="filterU.date_to" (change)="loadUsuarios()" />
            </label>
            <label class="filter-label">
              Límite
              <select [(ngModel)]="filterU.limit" (change)="loadUsuarios()">
                <option [value]="25">25</option>
                <option [value]="50">50</option>
                <option [value]="100">100</option>
                <option [value]="200">200</option>
              </select>
            </label>
          </div>
        </div>

        @if (error()) {
          <div class="alert-error">{{ error() }}</div>
        }

        <div class="table-wrap">
          @if (loading()) {
            <div class="loading-row"><div class="spinner"></div> Cargando actividad…</div>
          } @else if (!usuarios().length) {
            <div class="empty-msg">No hay actividad en el período seleccionado.</div>
          } @else {
            <table class="trace-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Total acciones</th>
                  <th>Exitosas</th>
                  <th>Parciales</th>
                  <th>Errores</th>
                  <th>% Éxito</th>
                  <th>Duración prom.</th>
                  <th>Última acción</th>
                  <th>Módulos usados</th>
                </tr>
              </thead>
              <tbody>
                @for (u of usuarios(); track u.id_usuario; let i = $index) {
                  <tr>
                    <td class="muted small">{{ i + 1 }}</td>
                    <td class="fw6">{{ u.usuario ?? 'Sistema' }}</td>
                    <td>
                      @if (u.perfil_nombre) {
                        <span class="badge-role">{{ u.perfil_nombre }}</span>
                      } @else { <span class="muted">—</span> }
                    </td>
                    <td class="fw6 mono">{{ u.total_acciones | number }}</td>
                    <td class="ok fw6">{{ u.exitosas | number }}</td>
                    <td class="warn">{{ u.parciales | number }}</td>
                    <td class="err">{{ u.errores | number }}</td>
                    <td>
                      <div class="progress-wrap">
                        <div class="progress-bar" [style.width.%]="successRate(u)"></div>
                        <span class="progress-lbl">{{ successRate(u) }}%</span>
                      </div>
                    </td>
                    <td class="mono small">{{ u.duracion_prom_ms ?? '—' }}ms</td>
                    <td class="mono nowrap small">{{ formatDate(u.ultima_accion) }}</td>
                    <td class="small muted">{{ truncate(u.modulos_usados ?? '—', 50) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page-wrap { padding: 1.5rem; max-width: 1400px; margin: 0 auto; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
    .page-title { font-size: 1.3rem; font-weight: 700; margin: 0 0 0.2rem; }
    .page-sub { color: var(--muted, #6b7280); font-size: 0.83rem; margin: 0; }

    .btn-refresh {
      display: flex; align-items: center; gap: 0.4rem;
      padding: 0.45rem 1rem; border-radius: 8px; font-size: 0.83rem; font-weight: 600;
      border: 1.5px solid var(--line, #e5e7eb); background: var(--surface, #fff); color: inherit;
      cursor: pointer; transition: border-color 0.15s; white-space: nowrap;
    }
    .btn-refresh:hover { border-color: var(--primary, #7c3aed); color: var(--primary, #7c3aed); }
    .btn-refresh:disabled { opacity: 0.5; cursor: not-allowed; }

    .tabs { display: flex; gap: 0.25rem; border-bottom: 2px solid var(--line, #e5e7eb); margin-bottom: 1rem; }
    .tab {
      padding: 0.5rem 1.25rem; font-size: 0.86rem; font-weight: 600;
      background: none; border: none; border-bottom: 2px solid transparent; margin-bottom: -2px;
      color: var(--muted, #6b7280); cursor: pointer; transition: color 0.15s, border-color 0.15s;
    }
    .tab:hover { color: var(--text, #111); }
    .tab.active { color: var(--primary, #7c3aed); border-bottom-color: var(--primary, #7c3aed); }

    .filters-card {
      background: var(--surface, #fff); border: 1px solid var(--line, #e5e7eb);
      border-radius: 10px; padding: 1rem 1.25rem; margin-bottom: 1rem;
    }
    .filters-row { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: flex-end; }
    .filter-label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.76rem; font-weight: 600; color: var(--muted, #6b7280); min-width: 120px; }
    .filter-label.grow { flex: 1; min-width: 200px; }
    .filter-label input, .filter-label select {
      padding: 0.4rem 0.6rem; border: 1px solid var(--line, #d1d5db); border-radius: 6px;
      font-size: 0.86rem; background: var(--bg, #f9fafb); color: inherit;
    }
    .filter-label input:focus, .filter-label select:focus { outline: 2px solid var(--primary, #7c3aed); outline-offset: -1px; }

    .quick-stats { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .qs-item {
      display: flex; flex-direction: column; align-items: center; gap: 0.1rem;
      background: var(--surface, #fff); border: 1px solid var(--line, #e5e7eb);
      border-radius: 8px; padding: 0.6rem 1.25rem; min-width: 80px;
    }
    .qs-num { font-size: 1.25rem; font-weight: 700; line-height: 1; }
    .qs-num.ok, .ok { color: var(--success, #059669); }
    .qs-num.warn, .warn { color: var(--warning, #d97706); }
    .qs-num.err, .err { color: var(--danger, #dc2626); }
    .qs-lbl { font-size: 0.71rem; color: var(--muted, #6b7280); font-weight: 500; }

    .alert-error { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 0.65rem 1rem; color: #991b1b; font-size: 0.86rem; margin-bottom: 1rem; }

    .table-wrap { background: var(--surface, #fff); border: 1px solid var(--line, #e5e7eb); border-radius: 10px; overflow: auto; }
    .loading-row { display: flex; align-items: center; gap: 0.65rem; padding: 2.5rem; color: var(--muted, #6b7280); justify-content: center; font-size: 0.9rem; }
    .empty-msg { text-align: center; padding: 3rem; color: var(--muted, #6b7280); font-size: 0.9rem; }

    .spinner { width: 18px; height: 18px; border: 2px solid var(--line, #e5e7eb); border-top-color: var(--primary, #7c3aed); border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .trace-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; min-width: 900px; }
    .trace-table th {
      background: var(--surface-muted, #f3f4f6); padding: 0.5rem 0.7rem;
      text-align: left; font-weight: 700; font-size: 0.72rem; white-space: nowrap;
      border-bottom: 2px solid var(--line, #e5e7eb); color: var(--muted, #6b7280); letter-spacing: 0.04em; text-transform: uppercase;
    }
    .trace-table td { padding: 0.38rem 0.7rem; border-bottom: 1px solid var(--line, #f3f4f6); vertical-align: middle; }
    .trace-table tr:hover td { background: var(--surface-muted, #f9fafb); }
    .trace-table tr.expanded-row td { background: var(--surface-muted, #f3f4f6); }

    .mono { font-family: ui-monospace, 'Cascadia Code', monospace; }
    .nowrap { white-space: nowrap; }
    .small { font-size: 0.78rem; }
    .fw6 { font-weight: 600; }
    .muted { color: var(--muted, #9ca3af); }
    .endpoint { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .badge-role {
      background: rgba(139,92,246,0.1); color: var(--primary, #7c3aed);
      border-radius: 99px; padding: 0.1rem 0.55rem; font-size: 0.7rem; font-weight: 600; white-space: nowrap;
    }
    .badge-mod {
      background: rgba(99,102,241,0.08); color: #4f46e5;
      border-radius: 6px; padding: 0.1rem 0.5rem; font-size: 0.7rem; font-weight: 700; white-space: nowrap;
    }

    .method { border-radius: 4px; padding: 0.08rem 0.45rem; font-size: 0.7rem; font-weight: 700; white-space: nowrap; }
    .method[data-method="GET"]    { background: rgba(16,185,129,0.1);  color: #059669; }
    .method[data-method="POST"]   { background: rgba(59,130,246,0.1);  color: #2563eb; }
    .method[data-method="PUT"]    { background: rgba(251,191,36,0.12); color: #92400e; }
    .method[data-method="PATCH"]  { background: rgba(251,191,36,0.12); color: #92400e; }
    .method[data-method="DELETE"] { background: rgba(239,68,68,0.1);   color: #dc2626; }

    .badge-estado { border-radius: 99px; padding: 0.1rem 0.6rem; font-size: 0.7rem; font-weight: 700; white-space: nowrap; }
    .badge-estado[data-estado="terminado"] { background: rgba(52,211,153,0.1); color: #059669; }
    .badge-estado[data-estado="parcial"]   { background: rgba(251,191,36,0.12); color: #92400e; }
    .badge-estado[data-estado="error"]     { background: rgba(239,68,68,0.1); color: #dc2626; }
    .badge-estado[data-estado="cancelado"] { background: rgba(156,163,175,0.1); color: #6b7280; }

    .http-status { font-family: ui-monospace, monospace; font-size: 0.75rem; font-weight: 700; }
    .http-status.ok   { color: #059669; }
    .http-status.warn { color: #d97706; }
    .http-status.err  { color: #dc2626; }

    .btn-expand { background: none; border: none; color: var(--muted, #9ca3af); cursor: pointer; font-size: 0.7rem; padding: 0.2rem 0.35rem; border-radius: 4px; transition: color 0.15s; }
    .btn-expand:hover { color: var(--primary, #7c3aed); }

    .detail-row td { padding: 0; border-bottom: 1px solid var(--line, #e5e7eb); background: var(--surface-muted, #f8f9fb) !important; }
    .detail-box { padding: 0.85rem 1.25rem; }
    .detail-grid { display: flex; flex-wrap: wrap; gap: 0.75rem; }
    .dg-item { display: flex; flex-direction: column; gap: 0.2rem; min-width: 220px; }
    .dg-item.full { width: 100%; }
    .dg-lbl { font-size: 0.69rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted, #9ca3af); }
    .dg-val { font-size: 0.83rem; }
    .dg-pre {
      background: var(--surface, #fff); border: 1px solid var(--line, #e5e7eb);
      border-radius: 6px; padding: 0.5rem 0.75rem; font-size: 0.75rem; overflow-x: auto;
      font-family: ui-monospace, 'Cascadia Code', monospace; white-space: pre; margin: 0; color: inherit;
    }

    .progress-wrap { display: flex; align-items: center; gap: 0.5rem; min-width: 80px; }
    .progress-bar { height: 6px; background: var(--success, #10b981); border-radius: 3px; flex-shrink: 0; max-width: 60px; }
    .progress-lbl { font-size: 0.75rem; font-weight: 600; color: var(--success, #059669); white-space: nowrap; }

    /* dark mode */
    :host-context([data-theme="dark"]) .filters-card { background: var(--surface); border-color: var(--line); }
    :host-context([data-theme="dark"]) .filter-label input,
    :host-context([data-theme="dark"]) .filter-label select { background: var(--surface-muted); border-color: var(--line); }
    :host-context([data-theme="dark"]) .qs-item { background: var(--surface); border-color: var(--line); }
    :host-context([data-theme="dark"]) .table-wrap { background: var(--surface); border-color: var(--line); }
    :host-context([data-theme="dark"]) .trace-table th { background: var(--surface-muted); color: var(--muted); }
    :host-context([data-theme="dark"]) .trace-table td { border-bottom-color: var(--line); }
    :host-context([data-theme="dark"]) .trace-table tr:hover td { background: rgba(255,255,255,0.03); }
    :host-context([data-theme="dark"]) .trace-table tr.expanded-row td { background: rgba(255,255,255,0.04); }
    :host-context([data-theme="dark"]) .badge-mod { background: rgba(99,102,241,0.15); color: #a5b4fc; }
    :host-context([data-theme="dark"]) .detail-row td { background: var(--surface-muted) !important; }
    :host-context([data-theme="dark"]) .dg-pre { background: var(--surface-muted); border-color: var(--line); }
    :host-context([data-theme="dark"]) .alert-error { background: rgba(239,68,68,0.08); border-color: rgba(239,68,68,0.25); color: var(--danger); }
    :host-context([data-theme="dark"]) .tabs { border-bottom-color: var(--line); }
  `]
})
export class TrazabilidadComponent implements OnInit {
  data      = signal<TraceEntry[]>([]);
  usuarios  = signal<UserActivity[]>([]);
  loading   = signal(false);
  error     = signal('');
  tab: Tab  = 'procesos';
  expanded: number | null = null;

  readonly procesos = PROCESOS;

  filter = {
    date_from: this.defaultDateFrom(),
    date_to: '',
    proceso: '',
    estado: '',
    search: '',
    limit: 100
  };

  filterU = {
    date_from: this.defaultDateFrom(),
    date_to: '',
    limit: 50
  };

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly api: ApiService, private readonly cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadProcesos();
  }

  setTab(t: Tab) {
    this.tab = t;
    this.error.set('');
    if (t === 'procesos' && !this.data().length) this.loadProcesos();
    if (t === 'usuarios' && !this.usuarios().length) this.loadUsuarios();
  }

  loadActive() {
    if (this.tab === 'procesos') this.loadProcesos();
    else this.loadUsuarios();
  }

  async loadProcesos() {
    this.loading.set(true);
    this.error.set('');
    try {
      const params = new URLSearchParams();
      if (this.filter.date_from) params.set('date_from', this.filter.date_from);
      if (this.filter.date_to)   params.set('date_to',   `${this.filter.date_to}T23:59:59`);
      if (this.filter.proceso)   params.set('proceso',   this.filter.proceso);
      if (this.filter.search)    params.set('search',    this.filter.search);
      params.set('limit', String(this.filter.limit));

      const res = await this.api.get<{ success: boolean; data: TraceEntry[] }>(
        `/traceability/processes?${params}`
      );
      this.data.set(res.data ?? []);
    } catch {
      this.error.set('No se pudo cargar la trazabilidad. Verifique la conexión con el servidor.');
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  async loadUsuarios() {
    this.loading.set(true);
    this.error.set('');
    try {
      const params = new URLSearchParams();
      if (this.filterU.date_from) params.set('date_from', this.filterU.date_from);
      if (this.filterU.date_to)   params.set('date_to',   `${this.filterU.date_to}T23:59:59`);
      params.set('limit', String(this.filterU.limit));

      const res = await this.api.get<{ success: boolean; data: UserActivity[] }>(
        `/traceability/users/activity?${params}`
      );
      this.usuarios.set(res.data ?? []);
    } catch {
      this.error.set('No se pudo cargar la actividad de usuarios.');
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  applyLocalFilter() {
    this.cdr.markForCheck();
  }

  filteredData() {
    const d = this.data();
    if (!this.filter.estado) return d;
    return d.filter(r => r.estado === this.filter.estado);
  }

  onSearchChange() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadProcesos(), 450);
  }

  toggleExpand(id: number) {
    this.expanded = this.expanded === id ? null : id;
    this.cdr.markForCheck();
  }

  countByEstado(estado: string) {
    return this.filteredData().filter(r => r.estado === estado).length;
  }

  avgDuration() {
    const rows = this.filteredData().filter(r => r.duracion_ms != null);
    if (!rows.length) return '—';
    const avg = rows.reduce((s, r) => s + (r.duracion_ms ?? 0), 0) / rows.length;
    return Math.round(avg);
  }

  successRate(u: UserActivity) {
    if (!u.total_acciones) return 0;
    return Math.round((u.exitosas / u.total_acciones) * 100);
  }

  formatDate(iso: string) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('es-CO', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  truncate(str: string, max: number) {
    return str.length > max ? `${str.slice(0, max)}…` : str;
  }

  estadoLabel(estado: string) {
    const map: Record<string, string> = {
      terminado: 'Exitoso', parcial: 'Parcial', error: 'Error', cancelado: 'Cancelado'
    };
    return map[estado] ?? estado;
  }

  formatJson(obj: Record<string, unknown> | null) {
    if (!obj) return '';
    return JSON.stringify(obj, null, 2);
  }

  private defaultDateFrom() {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }
}
