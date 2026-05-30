import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'akri-movimiento-salida',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './movimiento-salida.component.html',
  styleUrls: ['./movimiento-salida.component.css'],
  imports: [CommonModule, FormsModule]
})
export class MovimientoSalidaComponent implements OnInit {
  private api = inject(ApiService);

  loading = signal(false);
  saving = signal(false);
  message = signal('');
  error = signal('');
  allStock = signal<any[]>([]);
  filteredStock = signal<any[]>([]);
  loteSeleccionado = signal<any>(null);

  searchText = '';
  form = { tipo: 'salida_venta', cantidad: 1, motivo: '' };

  async ngOnInit() {
    await this.cargarStock();
  }

  async cargarStock() {
    this.loading.set(true);
    try {
      const resp: any = await this.api.get('/inventory/stock');
      const lista = Array.isArray(resp) ? resp : (resp?.data ?? []);
      // Solo lotes con stock disponible
      this.allStock.set(lista.filter((i: any) => Number(i.cantidad_disponible) > 0));
      this.filtrar();
    } catch {
      this.allStock.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  filtrar() {
    const q = this.searchText.toLowerCase().trim();
    const lista = this.allStock();
    this.filteredStock.set(!q ? lista : lista.filter(i =>
      (i.nombre_comercial || '').toLowerCase().includes(q) ||
      (i.sku || '').toLowerCase().includes(q) ||
      (i.numero_lote || '').toLowerCase().includes(q)
    ));
  }

  seleccionar(item: any) {
    this.loteSeleccionado.set(item);
    this.form.cantidad = 1;
    this.message.set('');
    this.error.set('');
  }

  deseleccionar() {
    this.loteSeleccionado.set(null);
    this.form = { tipo: 'salida_venta', cantidad: 1, motivo: '' };
  }

  clampCantidad() {
    const lote = this.loteSeleccionado();
    if (!lote) return;
    const max = Number(lote.cantidad_disponible);
    if (Number(this.form.cantidad) > max) this.form.cantidad = max;
    if (Number(this.form.cantidad) < 0) this.form.cantidad = 0;
  }

  vencClass(dias: number) {
    if (dias > 90) return 'badge-vence-ok';
    if (dias > 30) return 'badge-vence-warn';
    return 'badge-vence-bad';
  }

  async registrar() {
    this.error.set('');
    this.message.set('');
    const lote = this.loteSeleccionado();
    if (!lote) { this.error.set('Selecciona un lote.'); return; }
    if (!this.form.cantidad || Number(this.form.cantidad) <= 0) { this.error.set('La cantidad debe ser mayor a 0.'); return; }
    if (Number(this.form.cantidad) > Number(lote.cantidad_disponible)) {
      this.error.set(`La cantidad no puede superar el stock disponible (${lote.cantidad_disponible}).`);
      return;
    }

    this.saving.set(true);
    try {
      await this.api.post('/inventory/movements', {
        tipo: this.form.tipo,
        id_lote: lote.id_lote,
        id_almacen_origen: lote.id_almacen,
        id_ubicacion_origen: lote.id_ubicacion,
        cantidad: Number(this.form.cantidad),
        motivo: this.form.motivo || null
      });
      this.message.set('Salida de inventario registrada exitosamente.');
      await this.cargarStock();
      this.deseleccionar();
    } catch (err: any) {
      this.error.set(err?.error?.message || 'No fue posible registrar el movimiento.');
    } finally {
      this.saving.set(false);
    }
  }
}
