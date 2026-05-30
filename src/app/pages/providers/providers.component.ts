import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, FormsModule],
  templateUrl: './providers.component.html',
  styleUrls: ['./providers.component.css']
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
