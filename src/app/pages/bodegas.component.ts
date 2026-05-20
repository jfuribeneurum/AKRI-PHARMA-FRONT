import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'akri-bodegas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Modal: nueva / editar bodega -->
    @if (showModal()) {
      <div class="modal-backdrop" (click)="closeModal()">
        <div class="modal-panel" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div>
              <h3>{{ form.id_sede ? 'Editar bodega' : 'Nueva bodega' }}</h3>
              <div class="helper">Completa la información para aprovisionar los almacenes.</div>
            </div>
            <button class="btn secondary" (click)="closeModal()">✕ Cerrar</button>
          </div>

          @if (formMessage()) {
            <div class="success-box" style="margin-bottom: 1rem;">{{ formMessage() }}</div>
          }
          @if (formError()) {
            <div class="error-box" style="margin-bottom: 1rem;">{{ formError() }}</div>
          }

          <div class="form-grid">
            <label>
              Código de la bodega
              <input [(ngModel)]="form.codigo" placeholder="BOG-01">
            </label>
            <label>
              Nombre de la bodega
              <input [(ngModel)]="form.nombre" placeholder="Sede Norte">
            </label>
            <label>
              Ciudad
              <input [(ngModel)]="form.ciudad" placeholder="Ej: Bogotá">
            </label>
            <label>
              Teléfono
              <input [(ngModel)]="form.telefono" placeholder="Opcional">
            </label>
            <label>
              Correo electrónico
              <input [(ngModel)]="form.email" placeholder="Opcional">
            </label>
            <label>
              Responsable
              <input [(ngModel)]="form.responsable" placeholder="Nombre del encargado">
            </label>
          </div>

          <label style="display:block; margin-top: 0.9rem; font-weight: 600;">
            Dirección completa
            <textarea [(ngModel)]="form.direccion" placeholder="Dirección física de la bodega"></textarea>
          </label>

          <div class="switch-row" style="margin-top: 1rem;">
            <label><input type="checkbox" [(ngModel)]="form.es_principal"> Bodega principal (Sede matriz)</label>
            <label><input type="checkbox" [(ngModel)]="form.activo"> Bodega activa (Habilitada)</label>
          </div>

          <div class="form-actions" style="margin-top: 1.5rem;">
            <button class="btn secondary" (click)="closeModal()">Cancelar</button>
            <button class="btn" (click)="saveBodega()">{{ form.id_sede ? 'Actualizar bodega' : 'Crear bodega' }}</button>
          </div>
        </div>
      </div>
    }

    <!-- Vista principal -->
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Gestión de Bodegas</h1>
          <p class="page-subtitle">Administra las bodegas y sucursales donde se almacena el inventario de la farmacia.</p>
        </div>
        <button class="btn" (click)="openModal()">+ Agregar bodega</button>
      </div>

      @if (message()) {
        <div class="success-box" style="margin-bottom: 1rem;">{{ message() }}</div>
      }
      @if (error()) {
        <div class="error-box" style="margin-bottom: 1rem;">{{ error() }}</div>
      }

      <div class="card">
        <div class="toolbar">
          <span class="chip primary">{{ bodegas().length }} bodegas</span>
          <button class="btn secondary" (click)="load()">Actualizar</button>
        </div>

        <div class="table-wrap compact">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Bodega</th>
                <th>Ciudad</th>
                <th>Responsable</th>
                <th>Usuarios</th>
                <th>Almacenes</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              @for (row of bodegas(); track row.id_sede) {
                <tr [class.inactive]="!row.activo">
                  <td><strong>{{ row.codigo }}</strong></td>
                  <td>
                    <div>{{ row.nombre }}</div>
                    @if (row.es_principal) {
                      <span class="chip info">Sede principal</span>
                    }
                  </td>
                  <td>{{ row.ciudad || '—' }}</td>
                  <td>{{ row.responsable || '—' }}</td>
                  <td>{{ row.usuarios }}</td>
                  <td>{{ row.almacenes }}</td>
                  <td>
                    <span class="chip" [ngClass]="row.activo ? 'success' : 'warn'">
                      {{ row.activo ? 'Activa' : 'Inactiva' }}
                    </span>
                  </td>
                  <td>
                    <button class="btn secondary btn-small" (click)="editBodega(row)">Editar</button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8" class="muted" style="text-align:center; padding: 2rem;">
                    No hay bodegas registradas. Usa "+ Agregar bodega" para comenzar.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .modal-panel {
      background: var(--surface, #fff);
      border-radius: 18px;
      padding: 1.5rem;
      width: 100%;
      max-width: 760px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 8px 40px rgba(0,0,0,0.18);
    }
    .modal-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    .modal-header h3 {
      margin: 0 0 0.25rem;
    }
    tr.inactive td {
      opacity: 0.55;
    }
  `]
})
export class BodegasComponent implements OnInit {
  readonly bodegas = signal<any[]>([]);
  readonly message = signal('');
  readonly error = signal('');
  readonly formMessage = signal('');
  readonly formError = signal('');
  readonly showModal = signal(false);

  form: any = this.blankForm();

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    void this.load();
  }

  openModal() {
    this.form = this.blankForm();
    this.formMessage.set('');
    this.formError.set('');
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  editBodega(row: any) {
    this.form = { ...row };
    this.formMessage.set('');
    this.formError.set('');
    this.showModal.set(true);
  }

  async load() {
    try {
      this.error.set('');
      const response = await this.api.get<{ success: boolean; data: any[] }>('/admin/sites');
      this.bodegas.set(response.data);
    } catch (err: any) {
      this.error.set(err?.error?.message || 'No fue posible cargar las bodegas.');
    }
  }

  async saveBodega() {
    this.formError.set('');
    if (!this.form.codigo || !this.form.nombre) {
      this.formError.set('El código y el nombre son obligatorios.');
      return;
    }

    try {
      if (this.form.id_sede) {
        await this.api.put(`/admin/sites/${this.form.id_sede}`, this.form);
        this.message.set('Bodega actualizada exitosamente.');
      } else {
        await this.api.post('/admin/sites', this.form);
        this.message.set('Bodega creada exitosamente y almacenes aprovisionados.');
      }
      this.closeModal();
      await this.load();
    } catch (err: any) {
      this.formError.set(err?.error?.message || 'Hubo un problema al guardar la bodega.');
    }
  }

  private blankForm() {
    return {
      id_sede: null,
      codigo: '',
      nombre: '',
      ciudad: '',
      direccion: '',
      telefono: '',
      email: '',
      responsable: '',
      es_principal: false,
      activo: true
    };
  }
}