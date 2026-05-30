import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'akri-devolucion-pedido',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './devolucion-pedido.component.html',
  styleUrls: ['./devolucion-pedido.component.css'],
  imports: [CommonModule, FormsModule]
})
export class DevolucionPedidoComponent implements OnInit {
  readonly filterType = signal<'numero' | 'fecha' | 'laboratorio'>('numero');
  readonly allIngresos = signal<any[]>([]);
  readonly filteredIngresos = signal<any[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly ingresoSeleccionado = signal<any>(null);

  filter = { numero_oc: '', fecha_desde: '', fecha_hasta: '', laboratorio: '' };

  devMeta: any = this.emptyDevMeta();
  devItems: any[] = [];

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    void this.cargarIngresos();
  }

  async cargarIngresos() {
    this.loading.set(true);
    this.error.set('');
    try {
      const resp: any = await this.api.get<any>('/ingresos');
      const lista = Array.isArray(resp) ? resp : (resp?.data ?? []);
      this.allIngresos.set(lista);
      this.applyFilter();
    } catch (err: any) {
      this.error.set(err?.error?.message || 'No se pudieron cargar los ingresos.');
    } finally {
      this.loading.set(false);
    }
  }

  applyFilter() {
    const num = this.filter.numero_oc.toLowerCase().trim();
    const desde = this.filter.fecha_desde.trim();
    const hasta = this.filter.fecha_hasta.trim();
    const lab = this.filter.laboratorio.toLowerCase().trim();

    this.filteredIngresos.set(
      this.allIngresos().filter(row => {
        if (num && !String(row.referencia ?? '').toLowerCase().includes(num)) return false;
        const fecha = String(row.fecha_ingreso ?? '').slice(0, 10);
        if (desde && fecha < desde) return false;
        if (hasta && fecha > hasta) return false;
        if (lab && !String(row.producto ?? '').toLowerCase().includes(lab)) return false;
        return true;
      })
    );
  }

  setFilterType(type: 'numero' | 'fecha' | 'laboratorio') {
    this.filterType.set(type);
    this.filter = { numero_oc: '', fecha_desde: '', fecha_hasta: '', laboratorio: '' };
    this.applyFilter();
  }

  clearFilter() {
    this.filter = { numero_oc: '', fecha_desde: '', fecha_hasta: '', laboratorio: '' };
    this.applyFilter();
  }

  seleccionarIngreso(ing: any) {
    this.ingresoSeleccionado.set(ing);
    this.precargarDevolucion(ing);
  }

  deseleccionarIngreso() {
    this.ingresoSeleccionado.set(null);
    this.devMeta = this.emptyDevMeta();
    this.devItems = [];
  }

  clampDevolver(item: any) {
    const val = Number(item.cantidad_devolver) || 0;
    item.cantidad_devolver = Math.min(Math.max(val, 0), Number(item.cantidad_original) || 0);
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
        `Item ${idx + 1}: codigo=${i.codigo} | nombre=${i.nombre} | laboratorio=${i.laboratorio} | lote=${i.lote} | vencimiento=${i.fecha_vencimiento} | cantidad_devuelta=${i.cantidad_devolver} | cantidad_original=${i.cantidad_original}`
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
      });

      this.message.set('Devolución registrada exitosamente.');
      this.deseleccionarIngreso();
      await this.cargarIngresos();
    } catch (err: any) {
      this.error.set(err?.error?.message || 'No fue posible registrar la devolución.');
    } finally {
      this.saving.set(false);
    }
  }

  private precargarDevolucion(ing: any) {
    const producto = String(ing.producto ?? '');
    const meta = this.parseMeta(producto);

    this.devMeta = {
      referencia: `DEV-${ing.referencia}`,
      fecha: new Date().toISOString().slice(0, 10),
      motivo: '',
      observaciones: '',
      proveedor: meta['proveedor'] || '',
      sede: meta['sede'] || '',
      orden_original: meta['orden'] || meta['orden_de_compra'] || '',
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
    };
  }
}
