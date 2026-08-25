import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { SiteContextService } from '../../core/site-context.service';
import { UppercaseInputDirective } from '../../shared/uppercase-input.directive';

type Tab = 'enviar' | 'recibir';

interface TrasladoItem {
  id_lote: number | null;
  cantidad: number;
}

@Component({
  selector: 'akri-traslados',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './traslados.component.html',
  styleUrls: ['./traslados.component.css'],
  imports: [CommonModule, FormsModule, UppercaseInputDirective]
})
export class TrasladosComponent implements OnInit {
  private api = inject(ApiService);
  readonly siteContext = inject(SiteContextService);

  activeTab = signal<Tab>('enviar');

  // ── estado global ────────────────────────────────────────────
  loading  = signal(false);
  saving   = signal(false);
  message  = signal('');
  error    = signal('');

  // ── stock y lookups (pestaña enviar) ─────────────────────────
  allStock      = signal<any[]>([]);
  filteredStock = signal<any[]>([]);
  todasBodegas     = signal<any[]>([]);
  todasUbicaciones = signal<any[]>([]);

  searchText = '';
  idAlmacenDestino = 0;
  form = { motivo: '' };
  items: TrasladoItem[] = [this.emptyItem()];

  // ── traslados pendientes (pestaña recibir) ───────────────────
  loadingPendientes = signal(false);
  pendientes        = signal<any[]>([]);
  // Mapa id_traslado → { obs: string, rechazando: boolean }
  accionMap: Record<number, { obs: string; rechazando: boolean }> = {};

  async ngOnInit() {
    await Promise.all([this.cargarStock(), this.cargarLookups(), this.cargarPendientes()]);
  }

  setTab(tab: Tab) {
    this.activeTab.set(tab);
    this.message.set('');
    this.error.set('');
    if (tab === 'recibir') this.cargarPendientes();
  }

  // ─── ENVIAR ────────────────────────────────────────────────────────────────

  private emptyItem(): TrasladoItem {
    return { id_lote: null, cantidad: 1 };
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
      this.todasBodegas.set(data?.almacenes ?? []);
      this.todasUbicaciones.set(data?.ubicaciones ?? []);
    } catch {
      this.todasBodegas.set([]);
      this.todasUbicaciones.set([]);
    }
  }

  filtrar() {
    const q = this.searchText.toLowerCase().trim();
    const lista = this.allStock();
    this.filteredStock.set(!q ? lista : lista.filter((i: any) =>
      (i.nombre_comercial || '').toLowerCase().includes(q) ||
      (i.sku || '').toLowerCase().includes(q) ||
      (i.numero_lote || '').toLowerCase().includes(q)
    ));
  }

  loteFor(idLote: number | null): any | undefined {
    if (!idLote) return undefined;
    return this.allStock().find(i => i.id_lote === idLote);
  }

  nombreBodegaEmisora(): string {
    const id = this.siteContext.activeAlmacenId();
    const b = this.todasBodegas().find(x => x.id_almacen === id);
    return b?.nombre ?? this.siteContext.almacenes().find(a => a.id_almacen === id)?.nombre ?? '—';
  }

  nombreBodegaDestino(): string {
    const b = this.todasBodegas().find(x => x.id_almacen === Number(this.idAlmacenDestino));
    return b?.nombre ?? '';
  }

  addItem() {
    this.items.push(this.emptyItem());
  }

  removeItem(index: number) {
    this.items.splice(index, 1);
    if (!this.items.length) this.items.push(this.emptyItem());
  }

  onLoteChange(item: TrasladoItem, value: string) {
    item.id_lote = Number(value) || null;
    item.cantidad = 1;
  }

  clampCantidad(item: TrasladoItem) {
    const lote = this.loteFor(item.id_lote);
    if (!lote) return;
    const max = Number(lote.cantidad_disponible);
    if (Number(item.cantidad) > max) item.cantidad = max;
    if (Number(item.cantidad) < 1) item.cantidad = 1;
  }

  private reset() {
    this.items = [this.emptyItem()];
    this.idAlmacenDestino = 0;
    this.form = { motivo: '' };
  }

  private resolveUbicacionDestino(idAlmacen: number): number | null {
    const ubicacion = this.todasUbicaciones().find(u => u.id_almacen === idAlmacen);
    return ubicacion?.id_ubicacion ?? null;
  }

  async enviar() {
    this.error.set('');
    this.message.set('');

    const idAlmacenOrigen = this.siteContext.activeAlmacenId();
    if (!idAlmacenOrigen) { this.error.set('No hay una bodega activa en la sesión.'); return; }

    const idAlmacenDestino = Number(this.idAlmacenDestino);
    if (!idAlmacenDestino) { this.error.set('Selecciona la bodega receptora.'); return; }
    if (idAlmacenDestino === Number(idAlmacenOrigen)) {
      this.error.set('La bodega receptora debe ser diferente a la bodega emisora.'); return;
    }

    const idUbicacionDestino = this.resolveUbicacionDestino(idAlmacenDestino);
    if (!idUbicacionDestino) { this.error.set('La bodega receptora no tiene ubicaciones configuradas.'); return; }

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
        this.error.set(`Stock insuficiente para "${lote.nombre_comercial}". Máximo disponible: ${lote.cantidad_disponible}.`);
        return;
      }
    }

    this.saving.set(true);
    const fallidas: TrasladoItem[] = [];
    const fallos: string[] = [];
    let exitos = 0;

    for (const item of lineas) {
      const lote = this.loteFor(item.id_lote);
      try {
        await this.api.post('/traslados', {
          id_lote:              lote.id_lote,
          id_almacen_origen:    lote.id_almacen,
          id_ubicacion_origen:  lote.id_ubicacion,
          id_almacen_destino:   idAlmacenDestino,
          id_ubicacion_destino: idUbicacionDestino,
          cantidad:             Number(item.cantidad),
          motivo:               this.form.motivo || null
        });
        exitos++;
      } catch (err: any) {
        fallidas.push(item);
        fallos.push(`${lote.nombre_comercial}: ${err?.error?.message || 'error desconocido'}`);
      }
    }

    if (exitos) {
      this.message.set(`${exitos} traslado(s) enviado(s) hacia ${this.nombreBodegaDestino()}. Pendiente(s) de recepción.`);
    }
    if (fallos.length) {
      this.error.set(`No se pudieron enviar ${fallos.length} traslado(s): ${fallos.join(' | ')}`);
    }

    await this.cargarStock();
    if (!fallidas.length) {
      this.reset();
      this.activeTab.set('recibir');
      await this.cargarPendientes();
    } else {
      this.items = fallidas;
    }
    this.saving.set(false);
  }

  // ─── RECIBIR ───────────────────────────────────────────────────────────────

  async cargarPendientes() {
    this.loadingPendientes.set(true);
    try {
      const resp: any = await this.api.get('/traslados?estado=pendiente');
      const lista: any[] = Array.isArray(resp) ? resp : (resp?.data ?? []);
      this.pendientes.set(lista);
      // Inicializar mapa de acciones
      lista.forEach(t => {
        if (!this.accionMap[t.id_traslado]) {
          this.accionMap[t.id_traslado] = { obs: '', rechazando: false };
        }
      });
    } catch {
      this.pendientes.set([]);
    } finally {
      this.loadingPendientes.set(false);
    }
  }

  toggleRechazando(id: number) {
    if (!this.accionMap[id]) this.accionMap[id] = { obs: '', rechazando: false };
    this.accionMap[id].rechazando = !this.accionMap[id].rechazando;
  }

  getAcc(id: number) {
    if (!this.accionMap[id]) this.accionMap[id] = { obs: '', rechazando: false };
    return this.accionMap[id];
  }

  async confirmarRecepcion(t: any) {
    this.error.set('');
    this.message.set('');
    this.saving.set(true);
    try {
      const obs = this.accionMap[t.id_traslado]?.obs || null;
      await this.api.patch(`/traslados/${t.id_traslado}/recibir`, { observaciones: obs });
      this.message.set(`Recepción confirmada: ${t.cantidad} ud(s) de "${t.nombre_comercial}" recibidas en ${t.almacen_destino}.`);
      await this.cargarPendientes();
    } catch (err: any) {
      this.error.set(err?.error?.message || 'No fue posible confirmar la recepción.');
    } finally {
      this.saving.set(false);
    }
  }

  async rechazarTraslado(t: any) {
    this.error.set('');
    this.message.set('');
    this.saving.set(true);
    try {
      const motivo = this.accionMap[t.id_traslado]?.obs || null;
      await this.api.patch(`/traslados/${t.id_traslado}/rechazar`, { motivo });
      this.message.set(`Traslado #${t.id_traslado} rechazado.`);
      await this.cargarPendientes();
    } catch (err: any) {
      this.error.set(err?.error?.message || 'No fue posible rechazar el traslado.');
    } finally {
      this.saving.set(false);
    }
  }
}
