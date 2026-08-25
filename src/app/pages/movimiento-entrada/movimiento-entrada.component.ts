import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { UppercaseInputDirective } from '../../shared/uppercase-input.directive';

interface EntradaItem {
  id_lote: number | null;
  cantidad: number;
  costo_unitario: number;
}

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

  lookups: { almacenes: any[]; ubicaciones: any[] } = { almacenes: [], ubicaciones: [] };
  tiposMovimiento: { valor: string; etiqueta: string }[] = [];
  searchText = '';
  form = { tipo: 'entrada_compra', id_almacen_destino: 0, motivo: '' };
  items: EntradaItem[] = [this.emptyItem()];

  async ngOnInit() {
    await Promise.all([this.cargarStock(), this.cargarLookups()]);
  }

  async cargarDatos() {
    await Promise.all([this.cargarStock(), this.cargarLookups()]);
  }

  private emptyItem(): EntradaItem {
    return { id_lote: null, cantidad: 1, costo_unitario: 0 };
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

  onLoteChange(item: EntradaItem, value: string) {
    item.id_lote = Number(value) || null;
    item.cantidad = 1;
    const lote = this.loteFor(item.id_lote);
    item.costo_unitario = Number(lote?.costo_unitario) || 0;
  }

  private reset() {
    this.items = [this.emptyItem()];
    this.form = { tipo: 'entrada_compra', id_almacen_destino: 0, motivo: '' };
  }

  private resolveUbicacionDestino(idAlmacen: number): number | null {
    const ubicacion = this.lookups.ubicaciones.find(u => u.id_almacen === idAlmacen);
    return ubicacion?.id_ubicacion ?? null;
  }

  async registrar() {
    this.error.set('');
    this.message.set('');

    const idAlmacenDestino = Number(this.form.id_almacen_destino);
    if (!idAlmacenDestino) { this.error.set('Selecciona la bodega destino.'); return; }

    const idUbicacionDestino = this.resolveUbicacionDestino(idAlmacenDestino);
    if (!idUbicacionDestino) { this.error.set('La bodega destino no tiene ubicaciones configuradas.'); return; }

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
    }

    this.saving.set(true);
    const fallidas: EntradaItem[] = [];
    const fallos: string[] = [];
    let exitos = 0;

    for (const item of lineas) {
      const lote = this.loteFor(item.id_lote);
      try {
        await this.api.post('/inventory/movements', {
          tipo: this.form.tipo,
          id_lote: lote.id_lote,
          id_almacen_destino: idAlmacenDestino,
          id_ubicacion_destino: idUbicacionDestino,
          cantidad: Number(item.cantidad),
          costo_unitario: item.costo_unitario ? Number(item.costo_unitario) : null,
          motivo: this.form.motivo || null
        });
        exitos++;
      } catch (err: any) {
        fallidas.push(item);
        fallos.push(`${lote.nombre_comercial}: ${err?.error?.message || 'error desconocido'}`);
      }
    }

    if (exitos) {
      this.message.set(`${exitos} entrada(s) registrada(s) exitosamente.`);
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
