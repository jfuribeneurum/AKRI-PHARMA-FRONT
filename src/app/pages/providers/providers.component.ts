import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { UppercaseInputDirective } from '../../shared/uppercase-input.directive';

type ProviderForm = {
  id_proveedor: number | null;
  tipo_identificacion: string;
  numero_identificacion: string;
  digito_verificacion: string;
  razon_social: string;
  nombres: string;
  apellidos: string;
  telefono: string;
  email: string;
  ciudad: string;
  departamento: string;
  pais: string;
  direccion: string;
  observaciones: string;
  regimen: string;
  activo: boolean;
};

type CiudadItem = { nombre: string; departamento: string };

@Component({
  selector: 'akri-providers',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, FormsModule, UppercaseInputDirective],
  templateUrl: './providers.component.html',
  styleUrls: ['./providers.component.css']
})
export class ProvidersComponent implements OnInit {
  readonly providers = signal<ProviderForm[]>([]);
  readonly paises = signal<{ valor: string; etiqueta: string }[]>([]);
  readonly message = signal('');
  readonly error = signal('');
  readonly saving = signal(false);
  readonly ciudadesList = signal<CiudadItem[]>([]);
  tiposIdentificacion: { valor: string; etiqueta: string }[] = [];
  search = '';
  form = this.blankProvider();

  get ciudadNames(): string[] {
    return this.ciudadesList().map(c => c.nombre);
  }

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    this.loadProviders();
    this.loadCiudades();
    void this.loadTiposIdentificacion();
    void this.loadPaises();
  }

  private async loadTiposIdentificacion() {
    try {
      const res = await this.api.get<{ success: boolean; data: { valor: string; etiqueta: string }[] }>('/parametros/tipo_identificacion/activos');
      this.tiposIdentificacion = res.data ?? [];
    } catch { /* non-fatal */ }
  }

  private async loadPaises() {
    try {
      const res = await this.api.get<{ success: boolean; data: { valor: string; etiqueta: string }[] }>('/parametros/pais/activos');
      this.paises.set(res.data ?? []);
    } catch { /* non-fatal */ }
  }

  filteredProviders() {
    const term = this.search.trim().toLowerCase();
    if (!term) return this.providers();
    return this.providers().filter((p) =>
      [p.razon_social, p.numero_identificacion, p.nombres, p.apellidos, p.telefono, p.email, p.ciudad]
        .some((v) => String(v ?? '').toLowerCase().includes(term))
    );
  }

  onTipoIdentificacionChange() {
    if (this.form.tipo_identificacion !== 'NIT') {
      this.form.digito_verificacion = '';
      this.form.razon_social = '';
    }
    if (this.form.tipo_identificacion !== 'DIE') {
      this.form.pais = '';
    }
    if (this.form.tipo_identificacion === 'DIE') {
      this.form.ciudad = '';
      this.form.departamento = '';
    }
  }

  async saveProvider() {
    if (!this.form.numero_identificacion.trim()) {
      this.error.set('El número de identificación es obligatorio.');
      return;
    }
    if (this.form.tipo_identificacion === 'NIT' && !this.form.digito_verificacion.trim()) {
      this.error.set('El dígito de verificación es obligatorio para NIT.');
      return;
    }
    if (this.form.tipo_identificacion === 'NIT' && !this.form.razon_social.trim()) {
      this.error.set('La razón social es obligatoria para NIT.');
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
        tipo_identificacion: p.tipo_identificacion ?? 'NIT',
        numero_identificacion: p.numero_identificacion ?? '',
        digito_verificacion: p.digito_verificacion ?? '',
        razon_social: p.razon_social ?? p.nombre ?? '',
        nombres: p.nombres ?? '',
        apellidos: p.apellidos ?? '',
        telefono: p.telefono ?? '',
        email: p.email ?? '',
        ciudad: p.ciudad ?? '',
        departamento: p.departamento ?? '',
        pais: p.pais ?? '',
        direccion: p.direccion ?? '',
        observaciones: p.observaciones ?? '',
        regimen: p.regimen ?? '',
        activo: !!p.activo
      })));
    } catch {
      this.error.set('No se pudieron cargar los proveedores.');
    }
  }

  private blankProvider(): ProviderForm {
    return {
      id_proveedor: null,
      tipo_identificacion: 'NIT',
      numero_identificacion: '',
      digito_verificacion: '',
      razon_social: '',
      nombres: '',
      apellidos: '',
      telefono: '',
      email: '',
      ciudad: '',
      departamento: '',
      pais: '',
      direccion: '',
      observaciones: '',
      regimen: '',
      activo: true
    };
  }

  onCiudadInput() {
    const typed = this.form.ciudad.trim().toLowerCase();
    const match = this.ciudadesList().find(c => c.nombre.toLowerCase() === typed);
    if (match) this.form.departamento = match.departamento;
  }

  private async loadCiudades() {
    try {
      const resp: any = await this.api.get('/ciudades?limit=1200&soloActivas=true');
      const lista: any[] = resp?.data ?? [];
      this.ciudadesList.set(lista.map((c: any) => ({ nombre: c.nombre, departamento: c.departamento })));
    } catch { /* no bloquea el formulario */ }
  }
}
