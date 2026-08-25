import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { UppercaseInputDirective } from '../../shared/uppercase-input.directive';

interface SalidaItem {
  id_lote: number | null;
  cantidad: number;
}

@Component({
  selector: 'akri-movimiento-salida',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './movimiento-salida.component.html',
  styleUrls: ['./movimiento-salida.component.css'],
  imports: [CommonModule, FormsModule, UppercaseInputDirective]
})
export class MovimientoSalidaComponent implements OnInit {
  private api = inject(ApiService);

  loading = signal(false);
  saving = signal(false);
  message = signal('');
  error = signal('');
  allStock = signal<any[]>([]);
  filteredStock = signal<any[]>([]);

  searchText = '';
  form = { tipo: 'salida_venta', motivo: '' };
  tiposMovimiento: { valor: string; etiqueta: string }[] = [];
  items: SalidaItem[] = [this.emptyItem()];

  async ngOnInit() {
    await Promise.all([this.cargarStock(), this.cargarTipos()]);
  }

  private emptyItem(): SalidaItem {
    return { id_lote: null, cantidad: 1 };
  }

  private async cargarTipos() {
    try {
      const res = await this.api.get<{ success: boolean; data: { valor: string; etiqueta: string }[] }>('/parametros/tipo_movimiento_salida/activos');
      this.tiposMovimiento = res.data ?? [];
    } catch { /* non-fatal */ }
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

  loteFor(idLote: number | null): any | undefined {
    if (!idLote) return undefined;
    return this.allStock().find(i => i.id_lote === idLote);
  }

  addItem() {
    this.items.push(this.emptyItem());
  }

  removeItem(index: number) {
    this.items.splice(index, 1);
    if (!this.items.length) this.items.push(this.emptyItem());
  }

  onLoteChange(item: SalidaItem, value: string) {
    item.id_lote = Number(value) || null;
    item.cantidad = 1;
  }

  clampCantidad(item: SalidaItem) {
    const lote = this.loteFor(item.id_lote);
    if (!lote) return;
    const max = Number(lote.cantidad_disponible);
    if (Number(item.cantidad) > max) item.cantidad = max;
    if (Number(item.cantidad) < 0) item.cantidad = 0;
  }

  private reset() {
    this.items = [this.emptyItem()];
    this.form = { tipo: 'salida_venta', motivo: '' };
  }

  async registrar() {
    this.error.set('');
    this.message.set('');

    const lineas = this.items.filter(i => i.id_lote != null);
    if (!lineas.length) { this.error.set('Agrega al menos un producto.'); return; }

    const vistos = new Set<number>();
    for (const item of lineas) {
      const lote = this.loteFor(item.id_lote);
      if (!lote) { this.error.set('Selecciona un lote válido en cada línea.'); return; }
      if (vistos.has(item.id_lote as number)) {
        this.error.set(`Ya agregaste "${lote.nombre_comercial}" en otra línea; edita la cantidad en esa línea en su lugar.`);
        return;
      }
      vistos.add(item.id_lote as number);
      if (!item.cantidad || item.cantidad <= 0) {
        this.error.set(`La cantidad de "${lote.nombre_comercial}" debe ser mayor a 0.`);
        return;
      }
      if (item.cantidad > Number(lote.cantidad_disponible)) {
        this.error.set(`La cantidad de "${lote.nombre_comercial}" no puede superar el stock disponible (${lote.cantidad_disponible}).`);
        return;
      }
    }

    this.saving.set(true);
    const fallidas: SalidaItem[] = [];
    const fallos: string[] = [];
    let exitos = 0;

    for (const item of lineas) {
      const lote = this.loteFor(item.id_lote);
      try {
        await this.api.post('/inventory/movements', {
          tipo: this.form.tipo,
          id_lote: lote.id_lote,
          id_almacen_origen: lote.id_almacen,
          id_ubicacion_origen: lote.id_ubicacion,
          cantidad: Number(item.cantidad),
          motivo: this.form.motivo || null
        });
        exitos++;
      } catch (err: any) {
        fallidas.push(item);
        fallos.push(`${lote.nombre_comercial}: ${err?.error?.message || 'error desconocido'}`);
      }
    }

    if (exitos) {
      this.message.set(`${exitos} salida(s) registrada(s) exitosamente.`);
    }
    if (fallos.length) {
      this.error.set(`No se pudieron registrar ${fallos.length} movimiento(s): ${fallos.join(' | ')}`);
    }

    await this.cargarStock();
    if (!fallidas.length) {
      this.reset();
    } else {
      this.items = fallidas;
    }
    this.saving.set(false);
  }
}
