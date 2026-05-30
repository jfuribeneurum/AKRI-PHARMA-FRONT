import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'akri-bodegas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bodegas.component.html',
  styleUrls: ['./bodegas.component.css'],
  imports: [CommonModule, FormsModule]
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