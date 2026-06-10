import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { UppercaseInputDirective } from '../../shared/uppercase-input.directive';

@Component({
  selector: 'akri-movimiento-entrada',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './movimiento-entrada.component.html',
  styleUrls: ['./movimiento-entrada.component.css'],
  imports: [CommonModule, FormsModule, UppercaseInputDirective]
})
export class MovimientoEntradaComponent implements OnInit {
  private api = inject(ApiService);

  loading = signal(false);
  saving = signal(false);
  message = signal('');
  error = signal('');
  allStock = signal<any[]>([]);
  filteredStock = signal<any[]>([]);
  loteSeleccionado = signal<any>(null);

  lookups: { almacenes: any[]; ubicaciones: any[] } = { almacenes: [], ubicaciones: [] };
  tiposMovimiento: { valor: string; etiqueta: string }[] = [];
  searchText = '';
  form = { tipo: 'entrada_compra', id_ubicacion_destino: 0, cantidad: 1, costo_unitario: 0, motivo: '' };

  async ngOnInit() {
    await Promise.all([this.cargarStock(), this.cargarLookups()]);
  }

  async cargarDatos() {
    await Promise.all([this.cargarStock(), this.cargarLookups()]);
  }

  async cargarStock() {
    this.loading.set(true);
    try {
      const resp: any = await this.api.get('/inventory/stock');
      const lista = Array.isArray(resp) ? resp : (resp?.data ?? []);
      this.allStock.set(lista);
      this.filtrar();
    } catch {
      this.allStock.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async cargarLookups() {
    try {
      const [inv, tipos] = await Promise.all([
        this.api.get<any>('/inventory/lookups'),
        this.api.get<{ success: boolean; data: { valor: string; etiqueta: string }[] }>('/parametros/tipo_movimiento_entrada/activos')
      ]);
      const data = inv?.data ?? inv ?? {};
      this.lookups = { almacenes: data.almacenes ?? [], ubicaciones: data.ubicaciones ?? [] };
      this.tiposMovimiento = tipos.data ?? [];
    } catch {}
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
    this.form.costo_unitario = Number(item.costo_unitario) || 0;
    this.message.set('');
    this.error.set('');
  }

  deseleccionar() {
    this.loteSeleccionado.set(null);
    this.form = { tipo: 'entrada_compra', id_ubicacion_destino: 0, cantidad: 1, costo_unitario: 0, motivo: '' };
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
    if (!Number(this.form.id_ubicacion_destino)) { this.error.set('Selecciona la ubicación destino.'); return; }
    if (!this.form.cantidad || Number(this.form.cantidad) <= 0) { this.error.set('La cantidad debe ser mayor a 0.'); return; }

    this.saving.set(true);
    try {
      const idUbicacion = Number(this.form.id_ubicacion_destino);
      const idAlmacen = this.lookups.ubicaciones.find(u => u.id_ubicacion === idUbicacion)?.id_almacen ?? null;
      await this.api.post('/inventory/movements', {
        tipo: this.form.tipo,
        id_lote: lote.id_lote,
        id_almacen_destino: idAlmacen,
        id_ubicacion_destino: idUbicacion,
        cantidad: Number(this.form.cantidad),
        costo_unitario: this.form.costo_unitario ? Number(this.form.costo_unitario) : null,
        motivo: this.form.motivo || null
      });
      this.message.set('Entrada de inventario registrada exitosamente.');
      await this.cargarStock();
      this.deseleccionar();
    } catch (err: any) {
      this.error.set(err?.error?.message || 'No fue posible registrar el movimiento.');
    } finally {
      this.saving.set(false);
    }
  }
}
