import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { UppercaseInputDirective } from '../../shared/uppercase-input.directive';

interface ConsumoItem {
  id_lote: number | null;
  cantidad: number;
}

// Registra el consumo interno de dispositivos médicos (jeringas, agujas,
// catéteres, gasas, etc. — productos con tipo_producto = 'dispositivo') en
// procedimientos que no pasan por una formulación/dispensación de
// HealthSphere. A diferencia de Movimiento de Salida, aquí no hay selector
// de "tipo" — siempre es 'movimiento_interno', porque el punto de esta
// pantalla es simplificar el registro para el personal asistencial, no
// pedirles que clasifiquen el tipo de movimiento contable.
@Component({
  selector: 'akri-consumo-dispositivos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './consumo-dispositivos.component.html',
  styleUrls: ['./consumo-dispositivos.component.css'],
  imports: [CommonModule, FormsModule, UppercaseInputDirective]
})
export class ConsumoDispositivosComponent implements OnInit {
  private api = inject(ApiService);

  loading = signal(false);
  saving = signal(false);
  message = signal('');
  error = signal('');
  allStock = signal<any[]>([]);
  filteredStock = signal<any[]>([]);

  searchText = '';
  form = { motivo: '' };
  items: ConsumoItem[] = [this.emptyItem()];

  async ngOnInit() {
    await this.cargarStock();
  }

  private emptyItem(): ConsumoItem {
    return { id_lote: null, cantidad: 1 };
  }

  async cargarStock() {
    this.loading.set(true);
    try {
      const resp: any = await this.api.get('/inventory/stock?tipo_producto=dispositivo');
      const lista = Array.isArray(resp) ? resp : (resp?.data ?? []);
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

  onLoteChange(item: ConsumoItem, value: string) {
    item.id_lote = Number(value) || null;
    item.cantidad = 1;
  }

  clampCantidad(item: ConsumoItem) {
    const lote = this.loteFor(item.id_lote);
    if (!lote) return;
    const max = Number(lote.cantidad_disponible);
    if (Number(item.cantidad) > max) item.cantidad = max;
    if (Number(item.cantidad) < 0) item.cantidad = 0;
  }

  private reset() {
    this.items = [this.emptyItem()];
    this.form = { motivo: '' };
  }

  async registrar() {
    this.error.set('');
    this.message.set('');

    const lineas = this.items.filter(i => i.id_lote != null);
    if (!lineas.length) { this.error.set('Agrega al menos un dispositivo.'); return; }

    const vistos = new Set<number>();
    for (const item of lineas) {
      const lote = this.loteFor(item.id_lote);
      if (!lote) { this.error.set('Selecciona un dispositivo/lote válido en cada línea.'); return; }
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
    const fallidas: ConsumoItem[] = [];
    const fallos: string[] = [];
    let exitos = 0;

    for (const item of lineas) {
      const lote = this.loteFor(item.id_lote);
      try {
        await this.api.post('/inventory/movements', {
          tipo: 'movimiento_interno',
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
      this.message.set(`${exitos} consumo(s) de dispositivo(s) registrado(s) exitosamente.`);
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
