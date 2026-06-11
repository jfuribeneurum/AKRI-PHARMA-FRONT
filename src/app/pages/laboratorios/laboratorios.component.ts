import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

type LabForm = {
  id_laboratorio: number | null;
  nombre: string;
  activo: boolean;
};

@Component({
  selector: 'akri-laboratorios',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, FormsModule],
  templateUrl: './laboratorios.component.html',
  styleUrls: ['./laboratorios.component.css']
})
export class LaboratoriosComponent implements OnInit {
  readonly labs = signal<LabForm[]>([]);
  readonly message = signal('');
  readonly error = signal('');
  readonly saving = signal(false);

  search = '';
  form = this.blankLab();

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    this.loadLabs();
  }

  filteredLabs() {
    const term = this.search.trim().toLowerCase();
    if (!term) return this.labs();
    return this.labs().filter(l => l.nombre.toLowerCase().includes(term));
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
        await this.api.put(`/laboratorios/${this.form.id_laboratorio}`, { nombre: this.form.nombre, activo: this.form.activo });
        this.message.set('Laboratorio actualizado.');
      } else {
        await this.api.post('/laboratorios', { nombre: this.form.nombre, activo: this.form.activo });
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
      this.labs.set(lista.map(l => ({
        id_laboratorio: l.id_laboratorio,
        nombre: l.nombre ?? '',
        activo: !!l.activo,
      })));
    } catch {
      this.error.set('No se pudieron cargar los laboratorios.');
    }
  }

  private blankLab(): LabForm {
    return { id_laboratorio: null, nombre: '', activo: true };
  }
}
