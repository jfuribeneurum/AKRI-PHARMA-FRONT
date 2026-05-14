import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'akri-bodegas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Gestión de Bodegas</h1>
          <p class="page-subtitle">Administra las bodegas y sucursales donde se almacena el inventario de la farmacia.</p>
        </div>
        <div class="toolbar" style="margin-bottom: 0;">
          <button class="btn secondary" (click)="load()">Actualizar</button>
        </div>
      </div>

      <div *ngIf="message()" class="success-box" style="margin-bottom: 1rem;">{{ message() }}</div>
      <div *ngIf="error()" class="error-box" style="margin-bottom: 1rem;">{{ error() }}</div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-header">
            <div>
              <h3>Directorio de Bodegas</h3>
              <div class="helper">Listado completo de bodegas registradas.</div>
            </div>
            <span class="chip primary">{{ bodegas().length }} bodegas</span>
          </div>

          <div class="table-wrap compact">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Bodega</th>
                  <th>Usuarios</th>
                  <th>Almacenes</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of bodegas()" [class.inactive]="!row.activo">
                  <td><strong>{{ row.codigo }}</strong></td>
                  <td>
                    <div>{{ row.nombre }}</div>
                    <span class="chip info" *ngIf="row.es_principal">Sede principal</span>
                  </td>
                  <td>{{ row.usuarios }}</td>
                  <td>{{ row.almacenes }}</td>
                  <td>
                    <span class="chip" [ngClass]="row.activo ? 'success' : 'warn'">
                      {{ row.activo ? 'Activa' : 'Inactiva' }}
                    </span>
                  </td>
                  <td><button class="btn secondary btn-small" (click)="editBodega(row)">Editar</button></td>
                </tr>
                <tr *ngIf="!bodegas().length">
                  <td colspan="6" class="muted">No hay bodegas registradas en el sistema.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h3>{{ form.id_sede ? 'Editar bodega' : 'Nueva bodega' }}</h3>
              <div class="helper">Completa la información para aprovisionar los almacenes.</div>
            </div>
          </div>

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
            <button class="btn" (click)="saveBodega()">{{ form.id_sede ? 'Actualizar bodega' : 'Crear bodega' }}</button>
            <button class="btn secondary" *ngIf="form.id_sede" (click)="resetForm()">Cancelar edición</button>
          </div>
        </div>
      </div>
    </section>
  `
})
export class BodegasComponent implements OnInit {
  readonly bodegas = signal<any[]>([]);
  readonly message = signal('');
  readonly error = signal('');

  form: any = this.blankForm();

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    void this.load();
  }

  async load() {
    try {
      this.error.set('');
      this.message.set('');
      const response = await this.api.get<{ success: boolean; data: any[] }>('/admin/sites');
      this.bodegas.set(response.data);
    } catch (error: any) {
      this.error.set(error?.error?.message || 'No fue posible cargar las bodegas.');
    }
  }

  async saveBodega() {
    try {
      this.error.set('');
      if (!this.form.codigo || !this.form.nombre) {
        this.error.set('El código y el nombre son obligatorios.');
        return;
      }

      if (this.form.id_sede) {
        await this.api.put(`/admin/sites/${this.form.id_sede}`, this.form);
        this.message.set('Bodega actualizada exitosamente.');
      } else {
        await this.api.post('/admin/sites', this.form);
        this.message.set('Bodega creada exitosamente y almacenes aprovisionados.');
      }
      this.resetForm();
      await this.load();
    } catch (error: any) {
      this.error.set(error?.error?.message || 'Hubo un problema al guardar la bodega.');
    }
  }

  editBodega(row: any) {
    this.form = { ...row };
    this.message.set('');
    this.error.set('');
  }

  resetForm() {
    this.form = this.blankForm();
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
