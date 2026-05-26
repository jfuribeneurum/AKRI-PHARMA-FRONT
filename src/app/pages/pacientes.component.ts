import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'akri-pacientes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    .search-bar { display:flex; gap:0.65rem; align-items:center; flex-wrap:wrap; margin-bottom:1rem; }
    .search-bar input {
      flex:1; min-width:220px; padding:0.48rem 0.75rem;
      border:1px solid var(--color-border,#d1d5db); border-radius:8px;
      font-size:0.9rem; background:var(--color-surface,#fff); color:inherit;
    }
    .search-bar input:focus { outline:2px solid var(--color-primary,#2563eb); outline-offset:-1px; }
    .table-wrap { overflow-x:auto; }
    .data-table { width:100%; border-collapse:collapse; font-size:0.86rem; min-width:900px; }
    .data-table th {
      background:var(--color-surface-2,#f3f4f6); padding:0.55rem 0.8rem;
      text-align:left; font-weight:700; font-size:0.75rem; white-space:nowrap;
      border-bottom:2px solid var(--color-border,#e5e7eb); letter-spacing:0.02em;
    }
    .data-table td { padding:0.42rem 0.8rem; border-bottom:1px solid var(--color-border,#f3f4f6); vertical-align:middle; }
    .data-table tr:hover td { background:var(--color-surface-2,#f9fafb); }
    .nombre { font-weight:600; }
    .doc { color:#6b7280; font-size:0.82rem; }
    .empty-msg { text-align:center; color:#9ca3af; padding:3rem; font-size:0.95rem; }
    .badge { padding:0.12rem 0.55rem; border-radius:99px; font-size:0.71rem; font-weight:700; white-space:nowrap; }
    .badge-activo   { background:#d1fae5; color:#065f46; }
    .badge-inactivo { background:#fee2e2; color:#991b1b; }
    .badge-m { background:#dbeafe; color:#1e40af; }
    .badge-f { background:#fce7f3; color:#9d174d; }
    .pagination {
      display:flex; align-items:center; gap:0.4rem; margin-top:1rem;
      flex-wrap:wrap; font-size:0.83rem;
    }
    .pagination button {
      padding:0.28rem 0.65rem; border:1px solid var(--color-border,#d1d5db);
      border-radius:6px; background:var(--color-surface,#fff); color:inherit;
      cursor:pointer; font-size:0.82rem; transition:background 0.12s;
    }
    .pagination button:hover:not(:disabled) { background:var(--color-primary,#2563eb); color:#fff; border-color:var(--color-primary,#2563eb); }
    .pagination button:disabled { opacity:0.35; cursor:not-allowed; }
    .pagination button.pag-active { background:var(--color-primary,#2563eb); color:#fff; border-color:var(--color-primary,#2563eb); font-weight:700; }
    .pag-info { color:#6b7280; margin-left:0.25rem; }
    .total-badge {
      display:inline-block; background:var(--color-primary,#2563eb); color:#fff;
      border-radius:99px; padding:0.15rem 0.7rem; font-size:0.78rem; font-weight:700; margin-left:0.5rem;
    }
  `],
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">
            Listado de Pacientes
            @if (meta().total) {
              <span class="total-badge">{{ meta().total | number }}</span>
            }
          </h1>
          <p class="page-subtitle">Base de datos HealthSphere — db_suhc_produccion</p>
        </div>
        <div class="toolbar" style="margin-bottom:0">
          <button class="btn secondary" (click)="cargar()" [disabled]="loading()">
            {{ loading() ? 'Cargando...' : 'Actualizar' }}
          </button>
        </div>
      </div>

      @if (error()) { <div class="error-box">{{ error() }}</div> }

      <div class="card">
        <!-- Buscador -->
        <div class="search-bar">
          <input
            [(ngModel)]="buscar"
            placeholder="Buscar por nombre, apellido, documento, celular o correo..."
            (keyup.enter)="buscarAhora()"
          >
          <button class="btn" (click)="buscarAhora()" [disabled]="loading()">Buscar</button>
          @if (buscar) {
            <button class="btn secondary" (click)="limpiar()">Limpiar</button>
          }
        </div>

        <!-- Tabla -->
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Documento</th>
                <th>Nombre completo</th>
                <th>F. Nacimiento</th>
                <th>Sexo</th>
                <th>Celular</th>
                <th>Teléfono</th>
                <th>Correo</th>
                <th>Dirección</th>
                <th>Aseguradora</th>
                <th>Estado</th>
                <th>F. Registro</th>
              </tr>
            </thead>
            <tbody>
              @if (loading()) {
                <tr><td colspan="12" class="empty-msg">Cargando pacientes...</td></tr>
              } @else if (pacientes().length === 0) {
                <tr><td colspan="12" class="empty-msg">
                  {{ buscar ? 'No se encontraron pacientes con "' + buscar + '"' : 'No hay pacientes.' }}
                </td></tr>
              } @else {
                @for (p of pacientes(); track p.id) {
                  <tr>
                    <td style="color:#9ca3af;font-size:0.78rem">{{ p.id }}</td>
                    <td>
                      <span class="doc">{{ tipoDoc(p.tipo_documento) }}</span><br>
                      <strong>{{ p.documento }}</strong>
                    </td>
                    <td>
                      <span class="nombre">
                        {{ p.primer_nombre }} {{ p.segundo_nombre }}
                        {{ p.primer_apellido }} {{ p.segundo_apellido }}
                      </span>
                    </td>
                    <td>{{ p.fecha_nacimiento | date:'dd/MM/yyyy' }}</td>
                    <td>
                      <span class="badge" [class]="p.sexo === '1' ? 'badge-m' : 'badge-f'">
                        {{ p.sexo === '1' ? 'M' : p.sexo === '2' ? 'F' : p.sexo ?? '—' }}
                      </span>
                    </td>
                    <td>{{ p.celular || '—' }}</td>
                    <td>{{ p.telefono || '—' }}</td>
                    <td style="font-size:0.82rem">{{ p.correo || '—' }}</td>
                    <td style="font-size:0.82rem;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" [title]="p.direccion">
                      {{ p.direccion || '—' }}
                    </td>
                    <td style="font-size:0.82rem">{{ p.aseguradora || '—' }}</td>
                    <td>
                      <span class="badge" [class]="p.estado === '1' ? 'badge-activo' : 'badge-inactivo'">
                        {{ p.estado === '1' ? 'Activo' : 'Inactivo' }}
                      </span>
                    </td>
                    <td style="font-size:0.78rem;color:#6b7280;white-space:nowrap">
                      {{ p.fecha_registro | date:'dd/MM/yyyy' }}
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        <!-- Paginación -->
        @if (meta().paginas > 1 || pacientes().length > 0) {
          <div class="pagination">
            <button (click)="irPagina(1)" [disabled]="meta().pagina === 1">«</button>
            <button (click)="irPagina(meta().pagina - 1)" [disabled]="meta().pagina === 1">‹</button>

            @for (n of paginasVisibles(); track n) {
              <button [class.pag-active]="n === meta().pagina" (click)="irPagina(n)">{{ n }}</button>
            }

            <button (click)="irPagina(meta().pagina + 1)" [disabled]="meta().pagina >= meta().paginas">›</button>
            <button (click)="irPagina(meta().paginas)"    [disabled]="meta().pagina >= meta().paginas">»</button>

            <span class="pag-info">
              Página {{ meta().pagina }} de {{ meta().paginas }}
              &nbsp;·&nbsp; {{ meta().total | number }} pacientes en total
            </span>
          </div>
        }
      </div>
    </section>
  `
})
export class PacientesComponent implements OnInit {
  private api = inject(ApiService);

  loading   = signal(false);
  error     = signal('');
  pacientes = signal<any[]>([]);
  meta      = signal({ total: 0, pagina: 1, paginas: 1, limite: 50 });

  buscar       = '';
  paginaActual = 1;

  private readonly TIPOS_DOC: Record<number, string> = {
    1: 'CC', 2: 'TI', 3: 'RC', 4: 'RN', 5: 'CE', 6: 'PA',
    7: 'MS', 8: 'AS', 9: 'NIT', 10: 'CN', 11: 'PT', 12: 'PE'
  };

  async ngOnInit() {
    await this.cargar();
  }

  async cargar() {
    this.loading.set(true);
    this.error.set('');
    try {
      const params = new URLSearchParams();
      if (this.buscar.trim()) params.set('buscar', this.buscar.trim());
      params.set('pagina', String(this.paginaActual));
      params.set('limite', '50');

      const resp: any = await this.api.get(`/pacientes?${params.toString()}`);
      if (!resp?.success) { this.error.set(resp?.message ?? 'Error al cargar pacientes'); return; }

      this.pacientes.set(resp.data ?? []);
      this.meta.set(resp.meta ?? { total: 0, pagina: 1, paginas: 1, limite: 50 });
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Error de conexión con el servidor');
    } finally {
      this.loading.set(false);
    }
  }

  buscarAhora() {
    this.paginaActual = 1;
    this.cargar();
  }

  limpiar() {
    this.buscar = '';
    this.paginaActual = 1;
    this.cargar();
  }

  irPagina(n: number) {
    const m = this.meta();
    if (n < 1 || n > m.paginas || n === m.pagina) return;
    this.paginaActual = n;
    this.cargar();
  }

  paginasVisibles(): number[] {
    const { pagina, paginas } = this.meta();
    const delta = 2;
    const start = Math.max(1, pagina - delta);
    const end   = Math.min(paginas, pagina + delta);
    const pages: number[] = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  tipoDoc(codigo: number): string {
    return this.TIPOS_DOC[codigo] ?? `Tipo ${codigo}`;
  }
}
