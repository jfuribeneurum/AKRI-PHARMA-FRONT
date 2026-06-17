import { Component, OnInit, signal, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { UppercaseInputDirective } from '../../shared/uppercase-input.directive';

interface IngresoRow {
  id_ingreso: number;
  referencia: string;
  producto: string;
  cantidad: number;
  lote: string | null;
  fecha_vencimiento: string | null;
  estado: string;
  fecha_ingreso: string;
  creado_por: number | null;
  creado_por_nombre: string | null;
  // campos derivados (calculados en frontend tras cargar)
  _items_count: number;
  _primer_producto: string;
  _proveedor: string;
  _sede: string;
  _orden_original: string;
}

@Component({
  selector: 'akri-devolucion-pedido',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './devolucion-pedido.component.html',
  styleUrls: ['./devolucion-pedido.component.css'],
  imports: [CommonModule, FormsModule, UppercaseInputDirective]
})
export class DevolucionPedidoComponent implements OnInit {
  readonly filterType = signal<'numero' | 'fecha' | 'proveedor' | 'laboratorio'>('numero');
  readonly allIngresos = signal<IngresoRow[]>([]);
  readonly filteredIngresos = signal<IngresoRow[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly ingresoSeleccionado = signal<IngresoRow | null>(null);
  readonly mostrarTodos = signal(false);
  readonly expandedId = signal<number | null>(null);

  readonly notaCredito = signal('');
  notaCreditoInput = '';

  filter = { numero_oc: '', fecha_desde: '', fecha_hasta: '', laboratorio: '', proveedor: '' };

  devMeta: any = this.emptyDevMeta();
  devItems: any[] = [];

  motivosDevolucion: { valor: string; etiqueta: string }[] = [];

  constructor(private readonly api: ApiService, private readonly cdr: ChangeDetectorRef) {}

  ngOnInit() {
    void this.cargarIngresos();
    void this.loadMotivos();
  }

  private async loadMotivos() {
    try {
      const res = await this.api.get<{ success: boolean; data: { valor: string; etiqueta: string }[] }>('/parametros/motivo_devolucion/activos');
      this.motivosDevolucion = res.data ?? [];
      this.cdr.markForCheck();
    } catch { /* non-fatal */ }
  }

  async cargarIngresos() {
    this.loading.set(true);
    this.error.set('');
    try {
      const resp: any = await this.api.get<any>('/ingresos');
      const lista: any[] = Array.isArray(resp) ? resp : (resp?.data ?? []);
      // Enriquecer cada ingreso con campos derivados del campo `producto`
      const enriquecidos: IngresoRow[] = lista.map(row => {
        const texto = String(row.producto ?? '');
        const meta = this.parseMeta(texto);
        const items = this.parseAllItems(texto);
        const primerItem = items[0];
        return {
          ...row,
          _items_count: items.length || 1,
          _primer_producto: primerItem?.nombre ?? texto.split('\n')[0]?.trim() ?? '',
          _proveedor: meta['proveedor'] || meta['laboratorio'] || '',
          _sede: meta['sede'] || meta['bodega'] || '',
          _orden_original: meta['orden'] || meta['orden_de_compra'] || '',
        } as IngresoRow;
      });
      this.allIngresos.set(enriquecidos);
      this.applyFilter();
    } catch (err: any) {
      this.error.set(err?.error?.message || 'No se pudieron cargar los ingresos.');
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  applyFilter() {
    const num = this.filter.numero_oc.toLowerCase().trim();
    const desde = this.filter.fecha_desde.trim();
    const hasta = this.filter.fecha_hasta.trim();
    const lab = this.filter.laboratorio.toLowerCase().trim();
    const prov = this.filter.proveedor.toLowerCase().trim();
    const soloElegibles = !this.mostrarTodos();

    this.filteredIngresos.set(
      this.allIngresos().filter(row => {
        // Filtrar ingresos elegibles para devolución (no DEV-, solo recibido/almacenado)
        if (soloElegibles) {
          if (row.referencia.startsWith('DEV-')) return false;
          if (row.estado !== 'recibido') return false;
        }
        if (num && !row.referencia.toLowerCase().includes(num)) return false;
        const fecha = String(row.fecha_ingreso ?? '').slice(0, 10);
        if (desde && fecha < desde) return false;
        if (hasta && fecha > hasta) return false;
        if (lab && !String(row.producto ?? '').toLowerCase().includes(lab)) return false;
        if (prov && !row._proveedor.toLowerCase().includes(prov)) return false;
        return true;
      })
    );
    this.cdr.markForCheck();
  }

  setFilterType(type: 'numero' | 'fecha' | 'proveedor' | 'laboratorio') {
    this.filterType.set(type);
    this.filter = { numero_oc: '', fecha_desde: '', fecha_hasta: '', laboratorio: '', proveedor: '' };
    this.applyFilter();
  }

  clearFilter() {
    this.filter = { numero_oc: '', fecha_desde: '', fecha_hasta: '', laboratorio: '', proveedor: '' };
    this.applyFilter();
  }

  toggleMostrarTodos() {
    this.mostrarTodos.set(!this.mostrarTodos());
    this.applyFilter();
  }

  toggleExpand(id: number, event: Event) {
    event.stopPropagation();
    this.expandedId.set(this.expandedId() === id ? null : id);
    this.cdr.markForCheck();
  }

  getPreviewItems(ing: IngresoRow): any[] {
    return this.parseAllItems(String(ing.producto ?? ''));
  }

  seleccionarIngreso(ing: IngresoRow) {
    this.ingresoSeleccionado.set(ing);
    this.expandedId.set(null);
    this.precargarDevolucion(ing);
    this.cdr.markForCheck();
  }

  deseleccionarIngreso() {
    this.ingresoSeleccionado.set(null);
    this.devMeta = this.emptyDevMeta();
    this.devItems = [];
    this.cdr.markForCheck();
  }

  clampDevolver(item: any) {
    const val = Number(item.cantidad_devolver) || 0;
    item.cantidad_devolver = Math.min(Math.max(val, 0), Number(item.cantidad_original) || 0);
  }

  seleccionarTodas() {
    this.devItems.forEach(item => { item.cantidad_devolver = item.cantidad_original; });
    this.cdr.markForCheck();
  }

  limpiarTodas() {
    this.devItems.forEach(item => { item.cantidad_devolver = 0; });
    this.cdr.markForCheck();
  }

  totalOriginal(): number {
    return this.devItems.reduce((s, i) => s + (Number(i.cantidad_original) || 0), 0);
  }

  totalDevolver(): number {
    return this.devItems.reduce((s, i) => s + (Number(i.cantidad_devolver) || 0), 0);
  }

  async crearDevolucion() {
    this.error.set('');
    this.message.set('');

    if (!this.devMeta.motivo) {
      this.error.set('El motivo de devolución es obligatorio.');
      return;
    }
    const itemsADevolver = this.devItems.filter(i => Number(i.cantidad_devolver) > 0);
    if (!itemsADevolver.length) {
      this.error.set('Ingresa al menos una cantidad a devolver.');
      return;
    }

    this.saving.set(true);
    try {
      const itemLines = itemsADevolver.map((i, idx) =>
        `Item ${idx + 1}: codigo=${i.codigo} | nombre=${i.nombre} | laboratorio=${i.laboratorio} | lote=${i.lote} | vencimiento=${i.fecha_vencimiento} | cantidad_devuelta=${i.cantidad_devolver} | cantidad_original=${i.cantidad_original} | valor_unitario=${i.valor_unitario}`
      ).join('\n');

      const metaLines = [
        `Ingreso original: ${this.ingresoSeleccionado()?.referencia}`,
        `Proveedor: ${this.devMeta.proveedor}`,
        `Sede: ${this.devMeta.sede}`,
        `Orden: ${this.devMeta.orden_original}`,
        `Motivo: ${this.devMeta.motivo}`,
        `Observaciones: ${this.devMeta.observaciones}`,
      ].filter(l => !l.endsWith(': ')).join('\n');

      await this.api.post('/ingresos', {
        referencia: this.devMeta.referencia,
        producto: [metaLines, itemLines].filter(Boolean).join('\n'),
        cantidad: itemsADevolver.reduce((s, i) => s + Number(i.cantidad_devolver), 0),
        lote: itemsADevolver[0]?.lote || null,
        fecha_vencimiento: itemsADevolver[0]?.fecha_vencimiento || null,
        estado: 'cancelado',
        es_devolucion: true,
        ingreso_original_ref: this.ingresoSeleccionado()?.referencia ?? null,
      });

      this.message.set(`Devolución ${this.devMeta.referencia} registrada exitosamente.`);
      this.deseleccionarIngreso();
      await this.cargarIngresos();
    } catch (err: any) {
      this.error.set(err?.error?.message || 'No fue posible registrar la devolución.');
    } finally {
      this.saving.set(false);
      this.cdr.markForCheck();
    }
  }

  confirmarNotaCredito() {
    const val = this.notaCreditoInput.trim();
    if (!val) {
      this.error.set('El código de la nota crédito es obligatorio.');
      return;
    }
    this.error.set('');
    this.notaCredito.set(val);
  }

  cambiarNotaCredito() {
    this.notaCredito.set('');
    this.notaCreditoInput = '';
    this.deseleccionarIngreso();
    this.error.set('');
    this.message.set('');
  }

  private precargarDevolucion(ing: IngresoRow) {
    const producto = String(ing.producto ?? '');
    const meta = this.parseMeta(producto);

    this.devMeta = {
      referencia: this.notaCredito(),
      fecha: new Date().toISOString().slice(0, 10),
      motivo: '',
      observaciones: '',
      proveedor: ing._proveedor || meta['proveedor'] || '',
      sede: ing._sede || meta['sede'] || '',
      orden_original: ing._orden_original || '',
      creado_por_nombre: ing.creado_por_nombre || null,
    };

    const items = this.parseAllItems(producto);
    this.devItems = items.length > 0
      ? items.map(item => ({
          codigo: item['codigo'] ?? '',
          nombre: item['nombre'] ?? '',
          laboratorio: item['laboratorio'] ?? '',
          lote: item['lote'] ?? ing.lote ?? '',
          fecha_vencimiento: item['vencimiento'] ?? ing.fecha_vencimiento ?? '',
          valor_unitario: Number(item['valor_unitario']) || 0,
          cantidad_original: Number(item['cantidad']) || Number(ing.cantidad) || 0,
          cantidad_devolver: 0,
        }))
      : [{
          codigo: '',
          nombre: producto.split('\n')[0]?.trim() ?? '',
          laboratorio: '',
          lote: ing.lote ?? '',
          fecha_vencimiento: ing.fecha_vencimiento ?? '',
          valor_unitario: 0,
          cantidad_original: Number(ing.cantidad) || 0,
          cantidad_devolver: 0,
        }];
  }

  private parseMeta(texto: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const line of texto.split('\n')) {
      if (line.startsWith('Item ')) continue;
      const idx = line.indexOf(':');
      if (idx < 1) continue;
      const key = line.slice(0, idx).trim().toLowerCase().replace(/\s+/g, '_').replace(/\//g, '_');
      const value = line.slice(idx + 1).trim();
      if (value) result[key] = value;
    }
    return result;
  }

  private parseAllItems(texto: string): Record<string, string>[] {
    const items: Record<string, string>[] = [];
    let i = 1;
    while (true) {
      const prefix = `Item ${i}:`;
      const line = texto.split('\n').find(l => l.startsWith(prefix));
      if (!line) break;
      const item: Record<string, string> = {};
      for (const part of line.slice(prefix.length).split('|')) {
        const eq = part.indexOf('=');
        if (eq < 1) continue;
        item[part.slice(0, eq).trim().toLowerCase()] = part.slice(eq + 1).trim();
      }
      items.push(item);
      i++;
    }
    return items;
  }

  private emptyDevMeta() {
    return {
      referencia: '',
      fecha: new Date().toISOString().slice(0, 10),
      motivo: '',
      observaciones: '',
      proveedor: '',
      sede: '',
      orden_original: '',
      creado_por_nombre: null,
    };
  }
}
