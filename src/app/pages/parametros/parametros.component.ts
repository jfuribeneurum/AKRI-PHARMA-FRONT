import { Component, OnInit, signal, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { UppercaseInputDirective } from '../../shared/uppercase-input.directive';

interface Grupo {
  grupo: string;
  grupo_label: string;
  total: number;
  activos: number;
}

interface Parametro {
  id: number;
  grupo: string;
  grupo_label: string;
  valor: string;
  etiqueta: string;
  orden: number;
  activo: boolean;
}

@Component({
  selector: 'akri-parametros',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, UppercaseInputDirective],
  templateUrl: './parametros.component.html',
  styleUrls: ['./parametros.component.css']
})
export class ParametrosComponent implements OnInit {
  readonly grupos      = signal<Grupo[]>([]);
  readonly opciones    = signal<Parametro[]>([]);
  readonly loading     = signal(false);
  readonly loadingOps  = signal(false);
  readonly error       = signal('');
  readonly success     = signal('');

  readonly showModal   = signal(false);
  readonly editMode    = signal(false);
  readonly saving      = signal(false);
  readonly modalError  = signal('');
  readonly deleting    = signal<number | null>(null);

  grupoActivo: Grupo | null = null;
  editingId: number | null = null;

  form = { valor: '', etiqueta: '', orden: 0 };

  constructor(
    private readonly api: ApiService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    void this.loadGrupos();
  }

  async loadGrupos() {
    this.loading.set(true);
    this.error.set('');
    try {
      const res = await this.api.get<{ success: boolean; data: Grupo[] }>('/parametros/grupos');
      this.grupos.set(res.data ?? []);
      if (!this.grupoActivo && res.data?.length) {
        await this.selectGrupo(res.data[0]);
      }
    } catch {
      this.error.set('No se pudieron cargar los grupos de parámetros');
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  async selectGrupo(g: Grupo) {
    this.grupoActivo = g;
    this.loadingOps.set(true);
    this.error.set('');
    this.showModal.set(false);
    try {
      const res = await this.api.get<{ success: boolean; data: Parametro[] }>(`/parametros/${g.grupo}`);
      this.opciones.set(res.data ?? []);
    } catch {
      this.error.set('Error cargando opciones');
    } finally {
      this.loadingOps.set(false);
      this.cdr.markForCheck();
    }
  }

  openCreate() {
    this.editMode.set(false);
    this.editingId = null;
    this.form = { valor: '', etiqueta: '', orden: (this.opciones().length + 1) };
    this.modalError.set('');
    this.showModal.set(true);
  }

  openEdit(p: Parametro) {
    this.editMode.set(true);
    this.editingId = p.id;
    this.form = { valor: p.valor, etiqueta: p.etiqueta, orden: p.orden };
    this.modalError.set('');
    this.showModal.set(true);
  }

  closeModal() {
    if (this.saving()) return;
    this.showModal.set(false);
  }

  async save() {
    if (!this.grupoActivo) return;
    const etiqueta = this.form.etiqueta.trim();
    const valor    = this.form.valor.trim();
    if (!etiqueta) { this.modalError.set('La etiqueta es requerida'); return; }
    if (!this.editMode() && !valor) { this.modalError.set('El valor es requerido'); return; }

    this.saving.set(true);
    this.modalError.set('');
    try {
      if (this.editMode() && this.editingId !== null) {
        await this.api.put(`/parametros/${this.editingId}`, { etiqueta, orden: this.form.orden });
      } else {
        await this.api.post('/parametros', {
          grupo:       this.grupoActivo.grupo,
          grupo_label: this.grupoActivo.grupo_label,
          valor,
          etiqueta,
          orden: this.form.orden
        });
      }
      this.showModal.set(false);
      this.success.set(this.editMode() ? 'Opción actualizada' : 'Opción creada');
      setTimeout(() => this.success.set(''), 3000);
      await Promise.all([this.selectGrupo(this.grupoActivo), this.loadGrupos()]);
    } catch (err: any) {
      this.modalError.set(err?.error?.message ?? 'Error al guardar');
    } finally {
      this.saving.set(false);
      this.cdr.markForCheck();
    }
  }

  async toggle(p: Parametro) {
    try {
      await this.api.patch(`/parametros/${p.id}/toggle`, {});
      await this.selectGrupo(this.grupoActivo!);
      await this.loadGrupos();
    } catch {
      this.error.set('Error al cambiar estado');
      this.cdr.markForCheck();
    }
  }

  async remove(p: Parametro) {
    if (!confirm(`¿Eliminar la opción "${p.etiqueta}"? Esta acción no se puede deshacer.`)) return;
    this.deleting.set(p.id);
    try {
      await this.api.delete(`/parametros/${p.id}`);
      this.success.set('Opción eliminada');
      setTimeout(() => this.success.set(''), 3000);
      await Promise.all([this.selectGrupo(this.grupoActivo!), this.loadGrupos()]);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Error al eliminar');
    } finally {
      this.deleting.set(null);
      this.cdr.markForCheck();
    }
  }
}
