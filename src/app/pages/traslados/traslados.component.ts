import { Component, OnInit, signal, inject, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'akri-traslados',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './traslados.component.html',
  styleUrls: ['./traslados.component.css'],
  imports: [CommonModule, FormsModule]
})
export class TrasladosComponent implements OnInit {
  private api = inject(ApiService);

  loading     = signal(false);
  saving      = signal(false);
  message     = signal('');
  error       = signal('');

  allStock    = signal<any[]>([]);
  filteredStock = signal<any[]>([]);
  loteSeleccionado = signal<any>(null);

  todasUbicaciones = signal<any[]>([]);
  ubicacionesDestino = computed(() => {
    const sel = this.loteSeleccionado();
    if (!sel) return this.todasUbicaciones();
    return this.todasUbicaciones().filter(u => u.id_ubicacion !== sel.id_ubicacion);
  });

  searchText = '';
  form = { id_ubicacion_destino: 0, cantidad: 1, motivo: '' };

  async ngOnInit() {
    await Promise.all([this.cargarStock(), this.cargarLookups()]);
  }

  async cargarStock() {
    this.loading.set(true);
    try {
      const resp: any = await this.api.get('/inventory/stock');
      const lista = Array.isArray(resp) ? resp : (resp?.data ?? []);
      this.allStock.set(lista.filter((i: any) => Number(i.cantidad_disponible) > 0));
      this.filtrar();
    } catch {
      this.allStock.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  async cargarLookups() {
    try {
      const resp: any = await this.api.get('/inventory/lookups');
      const data = resp?.data ?? resp;
      this.todasUbicaciones.set(data?.ubicaciones ?? []);
    } catch {
      this.todasUbicaciones.set([]);
    }
  }

  filtrar() {
    const q = this.searchText.toLowerCase().trim();
    const lista = this.allStock();
    this.filteredStock.set(!q ? lista : lista.filter((i: any) =>
      (i.nombre_comercial || '').toLowerCase().includes(q) ||
      (i.sku || '').toLowerCase().includes(q) ||
      (i.numero_lote || '').toLowerCase().includes(q) ||
      (i.almacen || '').toLowerCase().includes(q)
    ));
  }

  seleccionar(item: any) {
    this.loteSeleccionado.set(item);
    this.form = { id_ubicacion_destino: 0, cantidad: 1, motivo: '' };
    this.message.set('');
    this.error.set('');
  }

  deseleccionar() {
    this.loteSeleccionado.set(null);
    this.form = { id_ubicacion_destino: 0, cantidad: 1, motivo: '' };
  }

  clampCantidad() {
    const lote = this.loteSeleccionado();
    if (!lote) return;
    const max = Number(lote.cantidad_disponible);
    if (Number(this.form.cantidad) > max) this.form.cantidad = max;
    if (Number(this.form.cantidad) < 1) this.form.cantidad = 1;
  }

  vencClass(dias: number) {
    if (dias > 90) return 'badge-vence-ok';
    if (dias > 30) return 'badge-vence-warn';
    return 'badge-vence-bad';
  }

  nombreDestino(): string {
    const u = this.todasUbicaciones().find(x => x.id_ubicacion === Number(this.form.id_ubicacion_destino));
    return u ? `${u.almacen} › ${u.nombre}` : '';
  }

  async registrar() {
    this.error.set('');
    this.message.set('');
    const lote = this.loteSeleccionado();
    if (!lote) { this.error.set('Selecciona un lote de origen.'); return; }
    if (!this.form.id_ubicacion_destino) { this.error.set('Selecciona la ubicación de destino.'); return; }
    if (Number(this.form.id_ubicacion_destino) === Number(lote.id_ubicacion)) {
      this.error.set('La ubicación de destino debe ser diferente a la de origen.'); return;
    }
    if (!this.form.cantidad || Number(this.form.cantidad) <= 0) { this.error.set('La cantidad debe ser mayor a 0.'); return; }
    if (Number(this.form.cantidad) > Number(lote.cantidad_disponible)) {
      this.error.set(`Stock insuficiente. Máximo disponible: ${lote.cantidad_disponible}.`); return;
    }

    this.saving.set(true);
    try {
      await this.api.post('/inventory/movements', {
        tipo: 'traslado',
        id_lote: lote.id_lote,
        id_almacen_origen: lote.id_almacen,
        id_ubicacion_origen: lote.id_ubicacion,
        id_ubicacion_destino: Number(this.form.id_ubicacion_destino),
        cantidad: Number(this.form.cantidad),
        motivo: this.form.motivo || null
      });
      this.message.set(`Traslado registrado: ${this.form.cantidad} ud(s) de "${lote.nombre_comercial}" → ${this.nombreDestino()}.`);
      await this.cargarStock();
      this.deseleccionar();
    } catch (err: any) {
      this.error.set(err?.error?.message || 'No fue posible registrar el traslado.');
    } finally {
      this.saving.set(false);
    }
  }
}
