import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { UppercaseInputDirective } from '../../shared/uppercase-input.directive';

type LabForm = {
  id_laboratorio: number | null;
  codigo: string;
  tipo_identificacion: string;
  numero_identificacion: string;
  digito_verificacion: string;
  nombre: string;
  nombres: string;
  apellidos: string;
  telefono: string;
  email: string;
  pais: string;
  ciudad: string;
  departamento: string;
  direccion: string;
  activo: boolean;
};

type CiudadItem = { nombre: string; departamento: string };

@Component({
  selector: 'akri-laboratorios',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, FormsModule, UppercaseInputDirective],
  templateUrl: './laboratorios.component.html',
  styleUrls: ['./laboratorios.component.css']
})
export class LaboratoriosComponent implements OnInit {
  readonly labs = signal<LabForm[]>([]);
  readonly message = signal('');
  readonly error = signal('');
  readonly saving = signal(false);
  readonly ciudadesList = signal<CiudadItem[]>([]);

  tiposIdentificacion: { valor: string; etiqueta: string }[] = [];
  search = '';
  form = this.blankLab();

  get ciudadNames(): string[] {
    return this.ciudadesList().map(c => c.nombre);
  }

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    this.loadLabs();
    this.loadCiudades();
    void this.loadTiposIdentificacion();
  }

  private async loadTiposIdentificacion() {
    try {
      const res = await this.api.get<{ success: boolean; data: { valor: string; etiqueta: string }[] }>('/parametros/tipo_identificacion/activos');
      this.tiposIdentificacion = res.data ?? [];
    } catch { /* non-fatal */ }
  }

  filteredLabs() {
    const term = this.search.trim().toLowerCase();
    if (!term) return this.labs();
    return this.labs().filter((l) =>
      [l.codigo, l.nombre, l.numero_identificacion, l.nombres, l.apellidos, l.telefono, l.email, l.ciudad]
        .some((v) => String(v ?? '').toLowerCase().includes(term))
    );
  }

  async saveLab() {
    if (!this.form.nombre.trim()) {
      this.error.set('El nombre del laboratorio es obligatorio.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');

    try {
      if (this.form.id_laboratorio) {
        await this.api.put(`/laboratorios/${this.form.id_laboratorio}`, this.form);
        this.message.set('Laboratorio actualizado.');
      } else {
        await this.api.post('/laboratorios', this.form);
        this.message.set('Laboratorio creado.');
      }
      await this.loadLabs();
      this.resetForm();
    } catch (err: any) {
      this.error.set(err?.error?.message || 'Error al guardar el laboratorio.');
    } finally {
      this.saving.set(false);
    }
  }

  editLab(lab: LabForm) {
    this.form = { ...lab };
  }

  resetForm() {
    this.form = this.blankLab();
    this.message.set('');
    this.error.set('');
  }

  private async loadLabs() {
    try {
      const resp: any = await this.api.get('/laboratorios');
      const lista: any[] = Array.isArray(resp) ? resp : (resp?.data ?? []);
      this.labs.set(lista.map((l) => ({
        id_laboratorio: l.id_laboratorio,
        codigo: l.codigo ?? '',
        tipo_identificacion: l.tipo_identificacion ?? 'NIT',
        numero_identificacion: l.numero_identificacion ?? '',
        digito_verificacion: l.digito_verificacion ?? '',
        nombre: l.nombre ?? '',
        nombres: l.nombres ?? '',
        apellidos: l.apellidos ?? '',
        telefono: l.telefono ?? '',
        email: l.email ?? '',
        pais: l.pais ?? 'Colombia',
        ciudad: l.ciudad ?? '',
        departamento: l.departamento ?? '',
        direccion: l.direccion ?? '',
        activo: !!l.activo,
      })));
    } catch {
      this.error.set('No se pudieron cargar los laboratorios.');
    }
  }

  private blankLab(): LabForm {
    return {
      id_laboratorio: null,
      codigo: '',
      tipo_identificacion: 'NIT',
      numero_identificacion: '',
      digito_verificacion: '',
      nombre: '',
      nombres: '',
      apellidos: '',
      telefono: '',
      email: '',
      pais: 'Colombia',
      ciudad: '',
      departamento: '',
      direccion: '',
      activo: true,
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
