import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

interface Ciudad {
  id: number;
  nombre: string;
  departamento: string;
  codigo_dane: string | null;
  activo: boolean;
}

@Component({
  selector: 'akri-ciudades',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './ciudades.component.html',
  styleUrls: ['./ciudades.component.css']
})
export class CiudadesComponent implements OnInit {
  ciudades   = signal<Ciudad[]>([]);
  total      = signal(0);
  page       = signal(1);
  readonly limit = 50;
  loading    = signal(false);
  error      = signal('');
  success    = signal('');

  search       = '';
  filterDepto  = '';
  soloActivas  = false;
  departamentos = signal<string[]>([]);

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  showModal  = signal(false);
  editMode   = signal(false);
  saving     = signal(false);
  modalError = signal('');

  form = { id: 0, nombre: '', departamento: '', codigo_dane: '', activo: true };

  get totalPages() { return Math.max(1, Math.ceil(this.total() / this.limit)); }

  constructor(private api: ApiService) {}

  ngOnInit() {
    void this.loadDepartamentos();
    void this.load();
  }

  async loadDepartamentos() {
    try {
      const res = await this.api.get<any>('/ciudades/departamentos');
      this.departamentos.set(res.data ?? []);
    } catch { /* silencioso */ }
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const params = new URLSearchParams({
        search:      this.search,
        departamento: this.filterDepto,
        soloActivas: String(this.soloActivas),
        page:        String(this.page()),
        limit:       String(this.limit)
      });
      const res = await this.api.get<any>(`/ciudades?${params}`);
      this.ciudades.set(res.data ?? []);
      this.total.set(res.total ?? 0);
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Error al cargar ciudades');
    } finally {
      this.loading.set(false);
    }
  }

  resetAndLoad() { this.page.set(1); void this.load(); }

  onSearchChange() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.resetAndLoad(), 350);
  }

  clearFilters() {
    this.search = '';
    this.filterDepto = '';
    this.soloActivas = false;
    this.resetAndLoad();
  }

  goPage(p: number) { this.page.set(p); void this.load(); }

  openCreate() {
    this.form = { id: 0, nombre: '', departamento: this.filterDepto, codigo_dane: '', activo: true };
    this.editMode.set(false);
    this.modalError.set('');
    this.showModal.set(true);
  }

  openEdit(c: Ciudad) {
    this.form = { id: c.id, nombre: c.nombre, departamento: c.departamento, codigo_dane: c.codigo_dane ?? '', activo: c.activo };
    this.editMode.set(true);
    this.modalError.set('');
    this.showModal.set(true);
  }

  closeModal() { if (!this.saving()) this.showModal.set(false); }

  async save() {
    if (!this.form.nombre.trim() || !this.form.departamento.trim()) {
      this.modalError.set('Nombre y departamento son requeridos.');
      return;
    }
    this.saving.set(true);
    this.modalError.set('');
    try {
      const body = {
        nombre:       this.form.nombre.trim(),
        departamento: this.form.departamento.trim(),
        codigo_dane:  this.form.codigo_dane.trim() || null,
        activo:       this.form.activo
      };
      if (this.editMode()) {
        await this.api.put(`/ciudades/${this.form.id}`, body);
        this.success.set('Ciudad actualizada.');
      } else {
        await this.api.post('/ciudades', body);
        this.success.set('Ciudad creada.');
      }
      this.showModal.set(false);
      this.resetAndLoad();
      setTimeout(() => this.success.set(''), 3000);
    } catch (err: any) {
      this.modalError.set(err?.error?.message ?? 'Error al guardar');
    } finally {
      this.saving.set(false);
    }
  }

  async toggle(c: Ciudad) {
    try {
      await this.api.patch(`/ciudades/${c.id}/toggle`, {});
      void this.load();
    } catch (err: any) {
      this.error.set(err?.error?.message ?? 'Error al cambiar estado');
    }
  }
}
