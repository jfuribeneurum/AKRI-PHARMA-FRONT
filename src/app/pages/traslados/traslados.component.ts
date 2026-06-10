import { Component, OnInit, signal, inject, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { UppercaseInputDirective } from '../../shared/uppercase-input.directive';

type Tab = 'enviar' | 'recibir';

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

  activeTab = signal<Tab>('enviar');

  // ── estado global ────────────────────────────────────────────
  loading  = signal(false);
  saving   = signal(false);
  message  = signal('');
  error    = signal('');

  // ── stock (pestaña enviar) ───────────────────────────────────
  allStock      = signal<any[]>([]);
  filteredStock = signal<any[]>([]);
  loteSeleccionado = signal<any>(null);

  // ── lookups ──────────────────────────────────────────────────
  todasBodegas     = signal<any[]>([]);
  todasUbicaciones = signal<any[]>([]);

  idAlmacenDestino   = signal(0);
  idUbicacionDestino = signal(0);

  ubicacionesDestino = computed(() => {
    const idBodega = this.idAlmacenDestino();
    if (!idBodega) return [];
    const sel = this.loteSeleccionado();
    return this.todasUbicaciones().filter(u => {
      if (u.id_almacen !== idBodega) return false;
      if (sel && u.id_ubicacion === sel.id_ubicacion && u.id_almacen === sel.id_almacen) return false;
      return true;
    });
  });

  searchText = '';
  form = { cantidad: 1, motivo: '' };

  // ── traslados pendientes (pestaña recibir) ───────────────────
  loadingPendientes = signal(false);
  pendientes        = signal<any[]>([]);
  // Mapa id_traslado → { obs: string, rechazando: boolean }
  accionMap: Record<number, { obs: string; rechazando: boolean }> = {};

  async ngOnInit() {
    await Promise.all([this.cargarStock(), this.cargarLookups()]);
  }

  setTab(tab: Tab) {
    this.activeTab.set(tab);
    this.message.set('');
    this.error.set('');
    if (tab === 'recibir') this.cargarPendientes();
  }

  // ─── ENVIAR ────────────────────────────────────────────────────────────────

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
      (i.numero_lote || '').toLowerCase().includes(q) ||
      (i.almacen || '').toLowerCase().includes(q)
    ));
  }

  seleccionar(item: any) {
    this.loteSeleccionado.set(item);
    this.idAlmacenDestino.set(0);
    this.idUbicacionDestino.set(0);
    this.form = { cantidad: 1, motivo: '' };
    this.message.set('');
    this.error.set('');
  }

  deseleccionar() {
    this.loteSeleccionado.set(null);
    this.idAlmacenDestino.set(0);
    this.idUbicacionDestino.set(0);
    this.form = { cantidad: 1, motivo: '' };
  }

  onBodegaChange(id: any) {
    this.idAlmacenDestino.set(Number(id));
    this.idUbicacionDestino.set(0);
  }

  onUbicacionChange(id: any) {
    this.idUbicacionDestino.set(Number(id));
  }

  clampCantidad() {
    const lote = this.loteSeleccionado();
    if (!lote) return;
    const max = Number(lote.cantidad_disponible);
    if (Number(this.form.cantidad) > max) this.form.cantidad = max;
    if (Number(this.form.cantidad) < 1)   this.form.cantidad = 1;
  }

  vencClass(dias: number) {
    if (dias > 90) return 'badge-vence-ok';
    if (dias > 30) return 'badge-vence-warn';
    return 'badge-vence-bad';
  }

  nombreBodegaDestino(): string {
    const b = this.todasBodegas().find(x => x.id_almacen === this.idAlmacenDestino());
    return b?.nombre ?? '';
  }

  nombreUbicacionDestino(): string {
    const u = this.todasUbicaciones().find(x => x.id_ubicacion === this.idUbicacionDestino());
    return u?.nombre ?? '';
  }

  resumenCompleto(): boolean {
    return !!(this.idAlmacenDestino() && this.idUbicacionDestino() && Number(this.form.cantidad) > 0);
  }

  async enviar() {
    this.error.set('');
    this.message.set('');
    const lote = this.loteSeleccionado();
    if (!lote) { this.error.set('Selecciona un lote de origen.'); return; }
    if (!this.idAlmacenDestino())   { this.error.set('Selecciona la bodega receptora.'); return; }
    if (!this.idUbicacionDestino()) { this.error.set('Selecciona la ubicación destino.'); return; }
    if (this.idUbicacionDestino() === Number(lote.id_ubicacion) && this.idAlmacenDestino() === Number(lote.id_almacen)) {
      this.error.set('La ubicación de destino debe ser diferente a la de origen.'); return;
    }
    if (!this.form.cantidad || Number(this.form.cantidad) <= 0) { this.error.set('La cantidad debe ser mayor a 0.'); return; }
    if (Number(this.form.cantidad) > Number(lote.cantidad_disponible)) {
      this.error.set(`Stock insuficiente. Máximo disponible: ${lote.cantidad_disponible}.`); return;
    }

    this.saving.set(true);
    try {
      await this.api.post('/traslados', {
        id_lote:              lote.id_lote,
        id_almacen_origen:    lote.id_almacen,
        id_ubicacion_origen:  lote.id_ubicacion,
        id_almacen_destino:   this.idAlmacenDestino(),
        id_ubicacion_destino: this.idUbicacionDestino(),
        cantidad:             Number(this.form.cantidad),
        motivo:               this.form.motivo || null
      });
      const destino = `${this.nombreBodegaDestino()} › ${this.nombreUbicacionDestino()}`;
      this.message.set(`Traslado enviado: ${this.form.cantidad} ud(s) de "${lote.nombre_comercial}" → ${destino}. Pendiente de recepción.`);
      this.deseleccionar();
    } catch (err: any) {
      this.error.set(err?.error?.message || 'No fue posible registrar el traslado.');
    } finally {
      this.saving.set(false);
    }
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
