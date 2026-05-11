import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type ProviderForm = {
  id_proveedor: number | null;
  codigo: string;
  nombre: string;
  nit: string;
  contacto: string;
  telefono: string;
  email: string;
  direccion: string;
  activo: boolean;
};

@Component({
  selector: 'akri-providers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page grid">
      <div class="page-header">
        <div>
          <h1 class="page-title">Proveedores</h1>
          <p class="page-subtitle">Crea y organiza proveedores para compras, ingresos y trazabilidad de lotes.</p>
        </div>
        <button class="btn secondary" (click)="resetForm()">Nuevo proveedor</button>
      </div>

      <div *ngIf="message()" class="success-box">{{ message() }}</div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-header">
            <div>
              <h3>{{ form.id_proveedor ? 'Editar proveedor' : 'Crear proveedor' }}</h3>
              <div class="helper">Los datos quedan disponibles en esta estación mientras se conecta la API.</div>
            </div>
            <span class="chip" [ngClass]="form.activo ? 'success' : 'warn'">{{ form.activo ? 'Activo' : 'Inactivo' }}</span>
          </div>

          <div class="form-grid">
            <label>
              Código
              <input [(ngModel)]="form.codigo" placeholder="PROV-001">
            </label>
            <label>
              Nombre
              <input [(ngModel)]="form.nombre" placeholder="Nombre del proveedor">
            </label>
            <label>
              NIT
              <input [(ngModel)]="form.nit" placeholder="900000000-1">
            </label>
            <label>
              Contacto
              <input [(ngModel)]="form.contacto" placeholder="Persona de contacto">
            </label>
            <label>
              Teléfono
              <input [(ngModel)]="form.telefono" placeholder="Teléfono o celular">
            </label>
            <label>
              Email
              <input type="email" [(ngModel)]="form.email" placeholder="compras@proveedor.com">
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
            <button class="btn" (click)="saveProvider()">{{ form.id_proveedor ? 'Actualizar proveedor' : 'Guardar proveedor' }}</button>
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
            <input [(ngModel)]="search" placeholder="Buscar por nombre, NIT, código o contacto">
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Contacto</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let provider of filteredProviders()">
                  <td>
                    <strong>{{ provider.nombre }}</strong><br>
                    <span class="muted">{{ provider.codigo }} · NIT {{ provider.nit || 'pendiente' }}</span>
                  </td>
                  <td>
                    <div>{{ provider.contacto || 'Sin contacto' }}</div>
                    <span class="muted">{{ provider.telefono || provider.email || 'Sin canal registrado' }}</span>
                  </td>
                  <td>
                    <span class="chip" [ngClass]="provider.activo ? 'success' : 'warn'">{{ provider.activo ? 'Activo' : 'Inactivo' }}</span>
                  </td>
                  <td>
                    <button class="btn secondary btn-small" (click)="editProvider(provider)">Editar</button>
                  </td>
                </tr>
                <tr *ngIf="!filteredProviders().length">
                  <td colspan="4" class="muted">No hay proveedores para el filtro actual.</td>
                </tr>
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
  search = '';
  form = this.blankProvider();

  ngOnInit() {
    this.loadProviders();
  }

  filteredProviders() {
    const term = this.search.trim().toLowerCase();
    if (!term) return this.providers();
    return this.providers().filter((provider) =>
      [provider.codigo, provider.nombre, provider.nit, provider.contacto, provider.telefono, provider.email]
        .some((value) => String(value ?? '').toLowerCase().includes(term))
    );
  }

  saveProvider() {
    if (!this.form.codigo.trim() || !this.form.nombre.trim()) {
      this.message.set('Código y nombre son obligatorios.');
      return;
    }

    const providers = this.providers();
    const normalized = { ...this.form, codigo: this.form.codigo.trim(), nombre: this.form.nombre.trim() };

    if (normalized.id_proveedor) {
      this.providers.set(providers.map((item) => item.id_proveedor === normalized.id_proveedor ? normalized : item));
      this.message.set('Proveedor actualizado.');
    } else {
      const nextId = Math.max(0, ...providers.map((item) => Number(item.id_proveedor ?? 0))) + 1;
      this.providers.set([{ ...normalized, id_proveedor: nextId }, ...providers]);
      this.message.set('Proveedor creado.');
    }

    this.persistProviders();
    this.resetForm();
  }

  editProvider(provider: ProviderForm) {
    this.form = { ...provider };
  }

  resetForm() {
    this.form = this.blankProvider();
  }

  private loadProviders() {
    const stored = localStorage.getItem('akri_providers');
    if (!stored) {
      this.providers.set([
        {
          id_proveedor: 1,
          codigo: 'PROV-001',
          nombre: 'Proveedor principal',
          nit: '',
          contacto: '',
          telefono: '',
          email: '',
          direccion: '',
          activo: true
        }
      ]);
      this.persistProviders();
      return;
    }

    try {
      this.providers.set(JSON.parse(stored));
    } catch (_error) {
      this.providers.set([]);
    }
  }

  private persistProviders() {
    localStorage.setItem('akri_providers', JSON.stringify(this.providers()));
  }

  private blankProvider(): ProviderForm {
    return {
      id_proveedor: null,
      codigo: '',
      nombre: '',
      nit: '',
      contacto: '',
      telefono: '',
      email: '',
      direccion: '',
      activo: true
    };
  }
}
