import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { UppercaseInputDirective } from '../../shared/uppercase-input.directive';

interface EntradaItem {
  // 'existente': se elige un lote que ya tiene algún registro de stock en la
  // bodega activa (comportamiento original). 'nuevo': el producto no tiene
  // stock previo aquí (o es un lote nuevo de uno conocido) — se elige el
  // producto del catálogo completo y se indica número de lote / vencimiento
  // a mano; el backend lo crea si no existe (ver createMovement).
  modo: 'existente' | 'nuevo';
  id_lote: number | null;
  id_producto: number | null;
  nombre_producto: string;
  numero_lote: string;
  fecha_vencimiento: string;
  productoFiltro: string;
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
  // Catálogo completo (no solo lo que ya tiene stock en esta bodega) — usado
  // en modo "producto nuevo" para poder dar de alta cualquier MX.
  allProducts = signal<any[]>([]);

  lookups: { almacenes: any[]; ubicaciones: any[] } = { almacenes: [], ubicaciones: [] };
  tiposMovimiento: { valor: string; etiqueta: string }[] = [];
  searchText = '';
  // Vacío a propósito: 'entrada_compra' no es uno de los tipos que ofrece
  // /parametros/tipo_movimiento_entrada/activos (esa sale solo desde
  // Ingresos Pharma) — igual que en Movimiento de Salida, precargar un valor
  // fuera de las opciones del <select> dejaba el combo en blanco pero el
  // modelo seguía con ese tipo equivocado si el usuario no lo tocaba.
  form = { tipo: '', id_almacen_destino: 0, motivo: '' };
  items: EntradaItem[] = [this.emptyItem()];

  async ngOnInit() {
    await Promise.all([this.cargarStock(), this.cargarLookups(), this.cargarProductos()]);
  }

  async cargarDatos() {
    await Promise.all([this.cargarStock(), this.cargarLookups(), this.cargarProductos()]);
  }

  private async cargarProductos() {
    try {
      const res: any = await this.api.get('/products/for-po');
      this.allProducts.set(res?.data ?? []);
    } catch { /* non-fatal */ }
  }

  private emptyItem(): EntradaItem {
    return {
      modo: 'existente',
      id_lote: null, id_producto: null, nombre_producto: '',
      numero_lote: '', fecha_vencimiento: '', productoFiltro: '',
      cantidad: 1, costo_unitario: 0
    };
  }

  toggleModo(item: EntradaItem, modo: 'existente' | 'nuevo') {
    item.modo = modo;
    item.id_lote = null;
    item.id_producto = null;
    item.nombre_producto = '';
    item.numero_lote = '';
    item.fecha_vencimiento = '';
    item.productoFiltro = '';
    item.cantidad = 1;
    item.costo_unitario = 0;
  }

  productosFiltrados(item: EntradaItem) {
    const q = (item.productoFiltro ?? '').trim().toLowerCase();
    const all = this.allProducts();
    if (!q) return all.slice(0, 50);
    return all.filter((p) =>
      (p.nombre_medicamento_hs || p.nombre_comercial || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q)
    ).slice(0, 50);
  }

  onProductoNuevoSelect(item: EntradaItem, idProducto: string) {
    const prod = this.allProducts().find((p) => String(p.id_producto) === String(idProducto));
    if (!prod) return;
    item.id_producto = prod.id_producto;
    item.nombre_producto = prod.nombre_medicamento_hs || prod.nombre_comercial || '';
    item.costo_unitario = Number(prod.costo_referencia) || 0;
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
    this.form = { tipo: '', id_almacen_destino: 0, motivo: '' };
  }

  private resolveUbicacionDestino(idAlmacen: number): number | null {
    const ubicacion = this.lookups.ubicaciones.find(u => u.id_almacen === idAlmacen);
    return ubicacion?.id_ubicacion ?? null;
  }

  async registrar() {
    this.error.set('');
    this.message.set('');

    if (!this.form.tipo) { this.error.set('Selecciona el tipo de movimiento.'); return; }

    const idAlmacenDestino = Number(this.form.id_almacen_destino);
    if (!idAlmacenDestino) { this.error.set('Selecciona la bodega destino.'); return; }

    const idUbicacionDestino = this.resolveUbicacionDestino(idAlmacenDestino);
    if (!idUbicacionDestino) { this.error.set('La bodega destino no tiene ubicaciones configuradas.'); return; }

    const lineas = this.items.filter(i => i.modo === 'nuevo' ? i.id_producto != null : i.id_lote != null);
    if (!lineas.length) { this.error.set('Agrega al menos un producto.'); return; }

    const vistos = new Set<string>();
    for (const item of lineas) {
      const nombre = item.modo === 'nuevo' ? item.nombre_producto : this.loteFor(item.id_lote)?.nombre_comercial;
      if (item.modo === 'existente' && !this.loteFor(item.id_lote)) {
        this.error.set('Selecciona un lote válido en cada línea.');
        return;
      }
      const clave = item.modo === 'nuevo' ? `p:${item.id_producto}:${item.numero_lote}` : `l:${item.id_lote}`;
      if (vistos.has(clave)) {
        this.error.set(`Ya agregaste "${nombre}" en otra línea; edita la cantidad en esa línea en su lugar.`);
        return;
      }
      vistos.add(clave);
      if (!item.cantidad || item.cantidad <= 0) {
        this.error.set(`La cantidad de "${nombre}" debe ser mayor a 0.`);
        return;
      }
    }

    this.saving.set(true);
    const fallidas: EntradaItem[] = [];
    const fallos: string[] = [];
    let exitos = 0;

    for (const item of lineas) {
      const lote = item.modo === 'existente' ? this.loteFor(item.id_lote) : null;
      const nombre = item.modo === 'nuevo' ? item.nombre_producto : lote?.nombre_comercial;
      try {
        await this.api.post('/inventory/movements', {
          tipo: this.form.tipo,
          id_lote: item.modo === 'existente' ? lote?.id_lote : null,
          id_producto: item.modo === 'nuevo' ? item.id_producto : null,
          numero_lote: item.modo === 'nuevo' ? (item.numero_lote || null) : null,
          fecha_vencimiento: item.modo === 'nuevo' ? (item.fecha_vencimiento || null) : null,
          id_almacen_destino: idAlmacenDestino,
          id_ubicacion_destino: idUbicacionDestino,
          cantidad: Number(item.cantidad),
          costo_unitario: item.costo_unitario ? Number(item.costo_unitario) : null,
          motivo: this.form.motivo || null
        });
        exitos++;
      } catch (err: any) {
        fallidas.push(item);
        fallos.push(`${nombre}: ${err?.error?.message || 'error desconocido'}`);
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
