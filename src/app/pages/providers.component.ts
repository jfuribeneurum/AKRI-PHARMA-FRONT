import { Component, OnInit, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';

type ProviderForm = {
  id_proveedor: number | null;
  codigo: string;
  tipo_identificacion: string;
  numero_identificacion: string;
  digito_verificacion: string;
  razon_social: string;
  nombres: string;
  apellidos: string;
  telefono: string;
  email: string;
  ciudad: string;
  direccion: string;
  activo: boolean;
};

@Component({
  selector: 'akri-providers',
  standalone: true,
  imports: [NgClass, FormsModule],
  template: `
    <section class="page grid">
      <div class="page-header">
        <div>
          <h1 class="page-title">Proveedores</h1>
          <p class="page-subtitle">Crea y organiza proveedores para compras, ingresos y trazabilidad de lotes.</p>
        </div>
        <button class="btn secondary" (click)="resetForm()">Nuevo proveedor</button>
      </div>

      @if (message()) {
        <div class="success-box">{{ message() }}</div>
      }
      @if (error()) {
        <div class="error-box">{{ error() }}</div>
      }

      <div class="grid grid-2">
        <div class="card">
          <div class="card-header">
            <div>
              <h3>{{ form.id_proveedor ? 'Editar proveedor' : 'Crear proveedor' }}</h3>
            </div>
            <span class="chip" [ngClass]="form.activo ? 'success' : 'warn'">{{ form.activo ? 'Activo' : 'Inactivo' }}</span>
          </div>

          <div class="form-grid">
            <label>
              Tipo identificación
              <select [(ngModel)]="form.tipo_identificacion">
                <option value="NIT">NIT</option>
                <option value="CC">Cédula de ciudadanía</option>
                <option value="CE">Cédula de extranjería</option>
                <option value="Pasaporte">Pasaporte</option>
              </select>
            </label>
            <label>
              Número de identificación
              <input [(ngModel)]="form.numero_identificacion" placeholder="900000000">
            </label>
            <label>
              Dígito de verificación
              <input [(ngModel)]="form.digito_verificacion" placeholder="1" maxlength="2">
            </label>
            <label>
              Código interno
              <input [(ngModel)]="form.codigo" placeholder="PROV-001">
            </label>
            <label style="grid-column: span 2">
              Razón social
              <input [(ngModel)]="form.razon_social" placeholder="Nombre o razón social del proveedor">
            </label>
            <label>
              Nombres
              <input [(ngModel)]="form.nombres" placeholder="Nombres del contacto">
            </label>
            <label>
              Apellidos
              <input [(ngModel)]="form.apellidos" placeholder="Apellidos del contacto">
            </label>
            <label>
              Teléfono
              <input [(ngModel)]="form.telefono" placeholder="Teléfono o celular">
            </label>
            <label>
              Email
              <input type="email" [(ngModel)]="form.email" placeholder="compras@proveedor.com">
            </label>
            <label>
              Ciudad
              <input [(ngModel)]="form.ciudad" placeholder="Ciudad">
            </label>
          </div>

          <label class="report-label" style="margin-top: 0.9rem;">
            Dirección
            <textarea [(ngModel)]="form.direccion" placeholder="Dirección comercial"></textarea>
          </label>

          <div class="switch-row">
            <label>
              <input type="checkbox" [(ngModel)]="form.activo">
              Proveedor activo
            </label>
          </div>

          <div class="form-actions">
            <button class="btn secondary" (click)="resetForm()">Limpiar</button>
            <button class="btn" (click)="saveProvider()" [disabled]="saving()">
              {{ saving() ? 'Guardando...' : (form.id_proveedor ? 'Actualizar proveedor' : 'Guardar proveedor') }}
            </button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <h3>Directorio</h3>
              <div class="helper">{{ filteredProviders().length }} proveedores registrados</div>
            </div>
          </div>

          <div class="toolbar">
            <input [(ngModel)]="search" placeholder="Buscar por razón social, NIT, código o contacto">
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Contacto</th>
                  <th>Ciudad</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                @for (provider of filteredProviders(); track provider.id_proveedor) {
                  <tr>
                    <td>
                      <strong>{{ provider.razon_social }}</strong><br>
                      <span class="muted">
                        {{ provider.tipo_identificacion }} {{ provider.numero_identificacion }}{{ provider.digito_verificacion ? '-' + provider.digito_verificacion : '' }}
                      </span>
                    </td>
                    <td>
                      <div>{{ (provider.nombres + ' ' + provider.apellidos).trim() || 'Sin contacto' }}</div>
                      <span class="muted">{{ provider.telefono || provider.email || 'Sin canal registrado' }}</span>
                    </td>
                    <td>{{ provider.ciudad || '—' }}</td>
                    <td>
                      <span class="chip" [ngClass]="provider.activo ? 'success' : 'warn'">{{ provider.activo ? 'Activo' : 'Inactivo' }}</span>
                    </td>
                    <td>
                      <button class="btn secondary btn-small" (click)="editProvider(provider)">Editar</button>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" class="muted">No hay proveedores para el filtro actual.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  `
})
export class ProvidersComponent implements OnInit {
  readonly providers = signal<ProviderForm[]>([]);
  readonly message = signal('');
  readonly error = signal('');
  readonly saving = signal(false);
  search = '';
  form = this.blankProvider();

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    this.loadProviders();
  }

  filteredProviders() {
    const term = this.search.trim().toLowerCase();
    if (!term) return this.providers();
    return this.providers().filter((p) =>
      [p.codigo, p.razon_social, p.numero_identificacion, p.nombres, p.apellidos, p.telefono, p.email, p.ciudad]
        .some((v) => String(v ?? '').toLowerCase().includes(term))
    );
  }

  async saveProvider() {
    if (!this.form.numero_identificacion.trim() || !this.form.razon_social.trim()) {
      this.error.set('Número de identificación y razón social son obligatorios.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');

    try {
      if (this.form.id_proveedor) {
        await this.api.put(`/providers/${this.form.id_proveedor}`, this.form);
        this.message.set('Proveedor actualizado.');
      } else {
        await this.api.post('/providers', this.form);
        this.message.set('Proveedor creado.');
      }
      await this.loadProviders();
      this.resetForm();
    } catch (err: any) {
      this.error.set(err?.error?.message || 'Error al guardar el proveedor.');
    } finally {
      this.saving.set(false);
    }
  }

  editProvider(provider: ProviderForm) {
    this.form = { ...provider };
  }

  resetForm() {
    this.form = this.blankProvider();
    this.message.set('');
    this.error.set('');
  }

  private async loadProviders() {
    try {
      const resp: any = await this.api.get('/providers');
      const lista: any[] = Array.isArray(resp) ? resp : (resp?.data ?? []);
      this.providers.set(lista.map((p) => ({
        id_proveedor: p.id_proveedor,
        codigo: p.codigo ?? '',
        tipo_identificacion: p.tipo_identificacion ?? 'NIT',
        numero_identificacion: p.numero_identificacion ?? '',
        digito_verificacion: p.digito_verificacion ?? '',
        razon_social: p.razon_social ?? p.nombre ?? '',
        nombres: p.nombres ?? '',
        apellidos: p.apellidos ?? '',
        telefono: p.telefono ?? '',
        email: p.email ?? '',
        ciudad: p.ciudad ?? '',
        direccion: p.direccion ?? '',
        activo: !!p.activo
      })));
    } catch {
      this.error.set('No se pudieron cargar los proveedores.');
    }
  }

  private blankProvider(): ProviderForm {
    return {
      id_proveedor: null,
      codigo: '',
      tipo_identificacion: 'NIT',
      numero_identificacion: '',
      digito_verificacion: '',
      razon_social: '',
      nombres: '',
      apellidos: '',
      telefono: '',
      email: '',
      ciudad: '',
      direccion: '',
      activo: true
    };
  }
}
